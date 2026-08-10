import type { BodyKey } from '../../data/bodies';
import { localGuide } from './localGuide';
import { hasRemoteGuide, remoteGuide } from './remoteGuide';
import { resolveSubject, type GuideSubject } from './subject';
import type { GuideLevel, GuideReply, GuideTurn } from './types';

/**
 * The assistant the UI talks to.
 *
 * Responsibilities are narrow on purpose: choose a provider, cache what is
 * worth caching, and never let a provider failure reach the user as a dead end.
 *
 * Degradation is one-way and silent-by-design: if a configured model times out
 * or errors, the grounded local narrator answers instead and the reply is
 * tagged `local` so the panel can say so. The user always gets an explanation.
 */

const provider = hasRemoteGuide() ? remoteGuide : localGuide;

export const activeProviderId = provider.id;

/* ==========================================================================
   Cache
   --------------------------------------------------------------------------
   Introductions are pure in (body, level), so clicking Mars → Jupiter → Mars
   should not regenerate or re-bill anything. Follow-up answers depend on the
   conversation and are deliberately not cached.
   ========================================================================== */

const introCache = new Map<string, GuideReply>();
const cacheKey = (key: BodyKey, level: GuideLevel): string => `${key}::${level}`;

/** Exposed for the UI's "already known" fast path and for tests. */
export const cachedIntroduction = (key: BodyKey, level: GuideLevel): GuideReply | undefined =>
  introCache.get(cacheKey(key, level));

export const subjectFor = (key: BodyKey): GuideSubject | null => resolveSubject(key);

const isAbort = (error: unknown): boolean =>
  error instanceof DOMException && (error.name === 'AbortError' || error.name === 'TimeoutError');

/**
 * Honour a signal that is already aborted.
 *
 * The local narrator is synchronous, so without this an aborted request would
 * resolve normally and the two providers would disagree about what cancelling
 * means. Callers do guard on `signal.aborted` after awaiting, so nothing leaks
 * either way — but a contract that only one implementation keeps is a trap for
 * whoever adds the third.
 */
const throwIfAborted = (signal?: AbortSignal): void => {
  if (signal?.aborted) throw new DOMException('Request aborted', 'AbortError');
};

export async function introduce(
  key: BodyKey,
  level: GuideLevel,
  signal?: AbortSignal,
): Promise<GuideReply> {
  throwIfAborted(signal);

  const cached = introCache.get(cacheKey(key, level));
  if (cached) return cached;

  const request = { key, level, history: [] as GuideTurn[], signal };

  try {
    const reply = await provider.introduce(request);
    introCache.set(cacheKey(key, level), reply);
    return reply;
  } catch (error) {
    // A cancelled request is the user clicking another planet — not a failure,
    // and it must not poison the cache or trigger the fallback narration.
    if (isAbort(error)) throw error;

    const reply = await localGuide.introduce(request);
    introCache.set(cacheKey(key, level), reply);
    return reply;
  }
}

export async function ask(
  key: BodyKey,
  level: GuideLevel,
  question: string,
  history: readonly GuideTurn[],
  signal?: AbortSignal,
): Promise<GuideReply> {
  throwIfAborted(signal);

  const request = { key, level, question, history, signal };

  try {
    return await provider.answer(request);
  } catch (error) {
    if (isAbort(error)) throw error;
    return localGuide.answer(request);
  }
}

/** Drop cached narration — used when the explanation level changes wholesale. */
export const clearGuideCache = (): void => introCache.clear();
