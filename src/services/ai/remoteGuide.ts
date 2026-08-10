import { buildContext, buildSystemPrompt } from './prompt';
import { resolveSubject } from './subject';
import type { GuideProvider, GuideReply, GuideRequest } from './types';

/**
 * Language-model provider.
 *
 * Deliberately takes a URL and no credential. A `VITE_`-prefixed variable is
 * inlined into the JavaScript bundle at build time and is readable by anyone
 * who opens the page, so putting a provider key there does not "expose" it in
 * some theoretical sense — it publishes it. `VITE_AI_API_URL` must therefore
 * point at an endpoint you control (a serverless function, or a route on your
 * own server) which holds the real key and forwards the request.
 *
 * The contract that endpoint must honour is small:
 *
 *   POST  { system: string, messages: {role, content}[] }
 *   200   { text: string }            — or an OpenAI-shaped choices[] response
 *
 * If nothing is configured this provider is never constructed, and the local
 * narrator serves every request.
 */

const ENDPOINT = import.meta.env.VITE_AI_API_URL as string | undefined;
const TIMEOUT_MS = 12_000;

export const hasRemoteGuide = (): boolean =>
  typeof ENDPOINT === 'string' && ENDPOINT.trim().length > 0;

interface ChatMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

/** Accept either our own minimal shape or an OpenAI-style completion. */
const extractText = (payload: unknown): string => {
  if (typeof payload === 'string') return payload;
  if (!payload || typeof payload !== 'object') return '';

  const record = payload as Record<string, unknown>;
  if (typeof record.text === 'string') return record.text;
  if (typeof record.content === 'string') return record.content;

  const choices = record.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const message = (choices[0] as Record<string, unknown>).message as
      | Record<string, unknown>
      | undefined;
    if (message && typeof message.content === 'string') return message.content;
  }
  return '';
};

const call = async (
  system: string,
  messages: readonly ChatMessage[],
  signal: AbortSignal | undefined,
): Promise<string> => {
  // Two independent reasons to give up: the caller changed their mind (a new
  // planet was clicked) or the endpoint is simply too slow to be part of a
  // click-to-speech interaction.
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  const composite = signal ? AbortSignal.any([signal, timeout]) : timeout;

  const response = await fetch(ENDPOINT as string, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ system, messages }),
    signal: composite,
  });

  if (!response.ok) {
    throw new Error(`Space guide endpoint returned ${response.status}`);
  }

  const text = extractText(await response.json());
  if (!text.trim()) throw new Error('Space guide endpoint returned an empty response');
  return text.trim();
};

export const remoteGuide: GuideProvider = {
  id: 'remote',

  async introduce({ key, level, signal }: GuideRequest): Promise<GuideReply> {
    const subject = resolveSubject(key);
    if (!subject) throw new Error('Unknown body');

    const text = await call(
      buildSystemPrompt(level),
      [
        { role: 'user', content: buildContext(subject) },
        {
          role: 'user',
          content: `Introduce ${subject.name} to me as I look at it on screen.`,
        },
      ],
      signal,
    );
    return { text, source: 'remote' };
  },

  async answer({ key, level, question, history, signal }): Promise<GuideReply> {
    const subject = resolveSubject(key);
    if (!subject) throw new Error('Unknown body');

    // The conversation is scoped to the selected body, so the whole history is
    // small and can be replayed for context without any summarisation step.
    const conversation: ChatMessage[] = history.map((turn) => ({
      role: turn.role === 'user' ? 'user' : 'assistant',
      content: turn.text,
    }));

    const text = await call(
      buildSystemPrompt(level),
      [
        { role: 'user', content: buildContext(subject) },
        ...conversation,
        { role: 'user', content: question },
      ],
      signal,
    );
    return { text, source: 'remote' };
  },
};
