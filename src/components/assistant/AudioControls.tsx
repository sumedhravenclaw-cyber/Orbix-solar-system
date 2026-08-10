import { memo, useId } from 'react';

import { useSpeechControls, useSpeechState } from '../../hooks/useTextToSpeech';
import { PauseIcon, PlayIcon, ResetIcon } from '../icons/Icons';
import styles from './SpaceAssistant.module.css';

/** Square glyphs, matched to the console's 1.5px stroke language. */
const StopIcon = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
    <rect x="4" y="4" width="8" height="8" rx="1" fill="currentColor" />
  </svg>
);

const SpeakerIcon = ({ size = 13 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M4 6H2v4h2l3 3V3L4 6Z" />
    <path d="M10 6a3 3 0 0 1 0 4" />
  </svg>
);

/**
 * Transport for the narration.
 *
 * Subscribes to the speech engine directly rather than receiving playback state
 * through props, so a progress tick re-renders this row and nothing else — the
 * narration text and the 3D scene above it are untouched several times a
 * second.
 */
export const AudioControls = memo(function AudioControls({ onReplay }: { onReplay: () => void }) {
  const { status, progress, volume, blocked, supported, error } = useSpeechState();
  const { pause, resume, stop, setVolume } = useSpeechControls();
  const volumeId = useId();

  const speaking = status === 'speaking';
  const paused = status === 'paused';
  const idle = status === 'idle';

  // With no engine at all the panel is still useful — it just becomes a reader.
  if (!supported && error) {
    return <p className={styles.error}>{error}</p>;
  }

  return (
    <>
      <div className={styles.transport}>
        <button
          type="button"
          className={`${styles.button} ${styles.primary}`}
          onClick={speaking ? pause : paused ? resume : onReplay}
          aria-label={speaking ? 'Pause narration' : paused ? 'Resume narration' : 'Play narration'}
          title={speaking ? 'Pause' : paused ? 'Resume' : 'Play'}
        >
          {speaking ? <PauseIcon size={13} /> : <PlayIcon size={13} />}
        </button>

        <button
          type="button"
          className={styles.button}
          onClick={onReplay}
          aria-label="Replay from the beginning"
          title="Replay"
        >
          <ResetIcon size={13} />
        </button>

        <button
          type="button"
          className={styles.button}
          onClick={stop}
          disabled={idle}
          aria-label="Stop narration"
          title="Stop"
        >
          <StopIcon size={13} />
        </button>

        <div
          className={styles.progressTrack}
          role="progressbar"
          aria-label="Narration progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <span className={styles.progressFill} style={{ inlineSize: `${progress * 100}%` }} />
        </div>
      </div>

      <div className={styles.volume}>
        <label className={styles.status} htmlFor={volumeId}>
          <SpeakerIcon size={12} />
          <span className="sr-only">Narration volume</span>
        </label>
        <input
          id={volumeId}
          type="range"
          className={styles.volumeSlider}
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(event) => setVolume(event.currentTarget.valueAsNumber)}
          aria-valuetext={`${Math.round(volume * 100)} percent`}
        />
      </div>

      {/* Autoplay refusal is a normal browser state, not an error — say what to
          do about it rather than reporting a failure. */}
      {blocked && (
        <p className={styles.status} role="status">
          Press play to hear the guide
        </p>
      )}
    </>
  );
});
