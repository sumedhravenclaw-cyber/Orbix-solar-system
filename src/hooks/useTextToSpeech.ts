import { useCallback, useSyncExternalStore } from 'react';

import { speech, type SpeechSnapshot } from '../services/audio/textToSpeech';

/**
 * Read the speech engine's state.
 *
 * `useSyncExternalStore` rather than mirroring into component state: playback
 * progress ticks several times a second and belongs to the engine, not to
 * React. Anything that does not subscribe never re-renders because of it.
 */
export function useSpeechState(): SpeechSnapshot {
  return useSyncExternalStore(speech.subscribe, speech.getSnapshot, speech.getSnapshot);
}

export interface SpeechControls {
  speak(text: string): void;
  pause(): void;
  resume(): void;
  stop(): void;
  setVolume(value: number): void;
  setRate(value: number): void;
}

/** Stable transport handles — safe to pass to memoised children. */
export function useSpeechControls(): SpeechControls {
  return {
    speak: useCallback((text: string) => speech.speak(text), []),
    pause: useCallback(() => speech.pause(), []),
    resume: useCallback(() => speech.resume(), []),
    stop: useCallback(() => speech.stop(), []),
    setVolume: useCallback((value: number) => speech.setVolume(value), []),
    setRate: useCallback((value: number) => speech.setRate(value), []),
  };
}
