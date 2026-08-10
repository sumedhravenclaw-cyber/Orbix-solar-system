import { memo, useEffect, useRef } from 'react';

import { useSpeechState } from '../../hooks/useTextToSpeech';
import { useAssistant } from '../../state/assistantContext';
import { useSimulationActions, useSimulationState } from '../../state/contexts';
import { CloseIcon } from '../icons/Icons';
import { StatusDot } from '../hud/Primitives';
import { AudioControls } from './AudioControls';
import { LevelSwitch } from './LevelSwitch';
import { QuestionInput } from './QuestionInput';
import { VoiceVisualizer } from './VoiceVisualizer';
import styles from './SpaceAssistant.module.css';

/**
 * The AI space guide.
 *
 * Sits above the target readout in the right rail rather than floating over the
 * scene: the readout already answers "what are the numbers", so the guide sits
 * directly above it answering "what am I looking at", and the 3D view stays
 * completely unobscured. Selection, highlight, reticle and camera focus are the
 * console's existing behaviour — this panel only listens to `selectedKey`.
 */
export const SpaceAssistant = memo(function SpaceAssistant() {
  const { selectedKey, phase } = useSimulationState();
  const { select } = useSimulationActions();
  const { status: speechStatus } = useSpeechState();

  const {
    subject,
    intro,
    turns,
    status,
    error,
    offline,
    level,
    pending,
    setLevel,
    askQuestion,
    replay,
  } = useAssistant();

  const transcriptRef = useRef<HTMLDivElement>(null);

  // Keep the newest exchange in view without yanking the whole page.
  useEffect(() => {
    const element = transcriptRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [turns.length, pending]);

  if (phase !== 'ready' || !selectedKey || !subject) return null;

  const speaking = speechStatus === 'speaking';

  return (
    <section className={styles.panel} aria-label={`AI space guide — ${subject.name}`}>
      <header className={styles.header}>
        <StatusDot tone={speaking ? 'amber' : 'cyan'} pulse={speaking} />
        <span className={styles.headerLabel}>AI Space Guide</span>
        <VoiceVisualizer active={speaking} />
        <span className={styles.headerRule} aria-hidden="true" />
        <button
          type="button"
          className={styles.close}
          onClick={() => select(null)}
          aria-label="Close the space guide"
          title="Close (Esc)"
        >
          <CloseIcon size={12} />
        </button>
      </header>

      <div className={styles.subject}>
        <span
          className={styles.swatch}
          style={{ background: subject.swatch, color: subject.swatch }}
          aria-hidden="true"
        />
        <div>
          <p className={styles.name}>{subject.name}</p>
          <p className={styles.tagline}>{subject.tagline}</p>
        </div>
      </div>

      {status === 'thinking' && <div className={styles.thinking} aria-hidden="true" />}

      {/* One polite announcement per narration, rather than a stream of
          partial updates fighting the screen reader. */}
      <p
        className={styles.narration}
        data-speaking={speaking}
        aria-live="polite"
        aria-busy={status === 'thinking'}
      >
        {status === 'thinking' ? `Reading the file on ${subject.name}…` : intro}
      </p>

      {turns.length > 0 && (
        <div className={styles.transcript} ref={transcriptRef}>
          {turns.map((turn, index) => (
            <div
              key={`${turn.role}-${index}`}
              className={`${styles.turn} ${turn.role === 'user' ? styles.turnUser : styles.turnGuide}`}
            >
              <span className={styles.turnRole}>{turn.role === 'user' ? 'You' : 'Guide'}</span>
              <p className={styles.turnText}>{turn.text}</p>
            </div>
          ))}
          {pending && (
            <div className={styles.turn}>
              <span className={styles.turnRole}>Guide</span>
              <p className={styles.turnText}>Checking what I know…</p>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className={styles.error} role="status">
          {error} You can still explore {subject.name} on screen.
        </p>
      )}

      <AudioControls onReplay={replay} />

      <LevelSwitch level={level} onChange={setLevel} />

      <QuestionInput
        subjectName={subject.name}
        disabled={pending || status === 'thinking'}
        onAsk={askQuestion}
      />

      {/* Never claim a model answered when the offline narrator did. */}
      {offline && (
        <p className={styles.status}>
          <StatusDot tone="mute" />
          Grounded in mission data
        </p>
      )}
    </section>
  );
});
