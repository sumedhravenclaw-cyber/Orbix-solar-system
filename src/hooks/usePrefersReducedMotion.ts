import { useSyncExternalStore } from 'react';

/**
 * Live subscription to `prefers-reduced-motion`.
 *
 * Reading the media query once on mount would miss the user changing the OS
 * setting while the tab is open — a real scenario for anyone who turns motion
 * off *because* something on screen is making them unwell.
 */

const QUERY = '(prefers-reduced-motion: reduce)';

const subscribe = (onChange: () => void): (() => void) => {
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
};

const getSnapshot = (): boolean => window.matchMedia(QUERY).matches;

/**
 * Imperative read, for code outside the render cycle.
 *
 * The engine needs the value once, at construction time, inside an effect.
 * Reading it here beats mirroring the hook's result into a ref — writing a ref
 * during render is exactly the pattern that makes state and DOM drift apart.
 */
export const matchesReducedMotion = getSnapshot;

/** SSR / prerender fallback: assume motion is fine, then correct on hydrate. */
const getServerSnapshot = (): boolean => false;

export const usePrefersReducedMotion = (): boolean =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
