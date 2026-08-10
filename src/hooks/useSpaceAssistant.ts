import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { BodyKey } from '../data/bodies';
import { ask, introduce, subjectFor } from '../services/ai/spaceAssistant';
import type { GuideSubject } from '../services/ai/subject';
import type { GuideLevel, GuideTurn } from '../services/ai/types';
import { speech } from '../services/audio/textToSpeech';
import { useSimulationState } from '../state/contexts';

/**
 * The assistant's conversation, bound to whatever the console has selected.
 *
 * The hard requirement is that nothing ever overlaps. Clicking a second planet
 * while the first is still narrating has to cancel the in-flight request,
 * silence the current audio, and reset the conversation before the new
 * introduction starts — otherwise two voices talk over each other and the
 * transcript belongs to neither body. One AbortController per exchange, torn
 * down in the effect's cleanup, gets that even when the user clicks through six
 * planets in two seconds.
 *
 * All per-subject state is one object, reset *during render* when the subject
 * or level changes. That is React's documented alternative to a reset effect:
 * resetting through `useEffect` would render the stale conversation for a frame
 * and trigger a second render to clear it.
 */

export type AssistantStatus = 'idle' | 'thinking' | 'ready' | 'error';

interface Conversation {
  /** The subject this conversation belongs to — the reset trigger. */
  readonly key: BodyKey | null;
  readonly level: GuideLevel;
  readonly intro: string;
  readonly turns: readonly GuideTurn[];
  readonly status: AssistantStatus;
  readonly error: string | null;
  readonly offline: boolean;
  readonly pending: boolean;
}

export interface SpaceAssistant {
  readonly subject: GuideSubject | null;
  readonly intro: string;
  readonly turns: readonly GuideTurn[];
  readonly status: AssistantStatus;
  readonly error: string | null;
  /** True when the last reply came from the grounded offline narrator. */
  readonly offline: boolean;
  readonly level: GuideLevel;
  readonly pending: boolean;
  setLevel(level: GuideLevel): void;
  askQuestion(question: string): void;
  /** Re-speak whatever is currently on screen. */
  replay(): void;
}

const blank = (key: BodyKey | null, level: GuideLevel): Conversation => ({
  key,
  level,
  intro: '',
  turns: [],
  status: key ? 'thinking' : 'idle',
  error: null,
  offline: false,
  pending: false,
});

export function useSpaceAssistant(): SpaceAssistant {
  const { selectedKey, phase } = useSimulationState();

  const [level, setLevel] = useState<GuideLevel>('explorer');
  const [convo, setConvo] = useState<Conversation>(() => blank(null, 'explorer'));

  const questionAbort = useRef<AbortController | null>(null);

  // Reset on a new subject or a new level. Conditional and self-clearing: the
  // very next render sees matching keys, so this cannot loop. Cancelling the
  // in-flight question is *not* done here — refs are off limits during render,
  // and the effect below fires on the same dependencies anyway.
  if (convo.key !== selectedKey || convo.level !== level) {
    setConvo(blank(selectedKey, level));
  }

  const subject = useMemo(() => (selectedKey ? subjectFor(selectedKey) : null), [selectedKey]);

  /* --- introduction ------------------------------------------------------- */

  useEffect(() => {
    // Any follow-up still in flight was asked about the previous body.
    questionAbort.current?.abort();
    questionAbort.current = null;

    if (!selectedKey || phase !== 'ready') {
      speech.stop();
      return;
    }

    const controller = new AbortController();

    // Silence the outgoing body before a word of the new one is generated.
    speech.stop();

    introduce(selectedKey, level, controller.signal)
      .then((reply) => {
        if (controller.signal.aborted) return;
        setConvo((current) =>
          current.key === selectedKey && current.level === level
            ? { ...current, intro: reply.text, status: 'ready', offline: reply.source === 'local' }
            : current,
        );
        // Selection came from a click or a keypress, so this runs inside a user
        // gesture and satisfies the autoplay policy. Where it does not, the
        // engine reports `blocked` and the panel offers a play button.
        speech.speak(reply.text);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setConvo((current) =>
          current.key === selectedKey && current.level === level
            ? {
                ...current,
                status: 'error',
                error:
                  cause instanceof Error
                    ? `I couldn't reach the space guide. ${cause.message}`
                    : "I couldn't reach the space guide right now.",
              }
            : current,
        );
      });

    return () => controller.abort();
  }, [selectedKey, level, phase]);

  // Silence on unmount, so a closed console never keeps talking.
  useEffect(() => () => speech.stop(), []);

  /* --- actions ------------------------------------------------------------ */

  const askQuestion = useCallback(
    (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || !selectedKey) return;

      questionAbort.current?.abort();
      const controller = new AbortController();
      questionAbort.current = controller;

      speech.stop();

      // Snapshot the history the answer will be conditioned on, before the
      // user's own turn is appended to it.
      let history: readonly GuideTurn[] = [];
      setConvo((current) => {
        history = current.turns;
        return {
          ...current,
          turns: [...current.turns, { role: 'user', text: trimmed }],
          pending: true,
          error: null,
        };
      });

      ask(selectedKey, level, trimmed, history, controller.signal)
        .then((reply) => {
          if (controller.signal.aborted) return;
          setConvo((current) =>
            current.key === selectedKey
              ? {
                  ...current,
                  turns: [...current.turns, { role: 'guide', text: reply.text }],
                  offline: reply.source === 'local',
                  pending: false,
                }
              : current,
          );
          speech.speak(reply.text);
        })
        .catch((cause: unknown) => {
          if (controller.signal.aborted) return;
          setConvo((current) =>
            current.key === selectedKey
              ? {
                  ...current,
                  pending: false,
                  error:
                    cause instanceof Error
                      ? `That question didn't get through. ${cause.message}`
                      : "That question didn't get through.",
                }
              : current,
          );
        });
    },
    [selectedKey, level],
  );

  const replay = useCallback(() => {
    const lastGuideTurn = [...convo.turns].reverse().find((turn) => turn.role === 'guide');
    const text = lastGuideTurn?.text ?? convo.intro;
    if (text) speech.speak(text);
  }, [convo.turns, convo.intro]);

  return {
    subject,
    intro: convo.intro,
    turns: convo.turns,
    status: convo.status,
    error: convo.error,
    offline: convo.offline,
    level,
    pending: convo.pending,
    setLevel,
    askQuestion,
    replay,
  };
}
