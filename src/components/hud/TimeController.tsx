import { memo, useId } from 'react';

import { YEAR_SECONDS } from '../../engine/scale';
import { formatElapsedYears, formatSpeed } from '../../lib/format';
import { useTelemetry } from '../../hooks/useTelemetry';
import { useSimulationActions, useSimulationState } from '../../state/contexts';
import { DEFAULT_SPEED_INDEX, SPEED_STEPS, speedFor } from '../../state/simulation';
import { PauseIcon, PlayIcon, ResetIcon } from '../icons/Icons';
import { StatusDot } from './Primitives';
import styles from './TimeController.module.css';

const SPEED_MAX = SPEED_STEPS.length - 1;

/**
 * Transport and mission clock.
 *
 * This is the console's primary chrome, so it is the <main> landmark and the
 * skip link's destination: for a keyboard user these controls, not the canvas,
 * are the content.
 *
 * The clock is `aria-live="off"` — a counter announcing itself eight times a
 * second makes a screen reader unusable. It stays readable on demand.
 */
export const TimeController = memo(function TimeController() {
  const { playing, speedIndex, phase } = useSimulationState();
  const { togglePlay, setSpeedIndex, resetView } = useSimulationActions();
  const { elapsedYears } = useTelemetry();
  const sliderId = useId();

  if (phase !== 'ready') return null;

  const multiplier = formatSpeed(speedFor(speedIndex));

  return (
    <main id="controls" className={styles.dock}>
      <div className={styles.bar}>
        <button
          type="button"
          className={styles.transport}
          onClick={togglePlay}
          aria-pressed={!playing}
          aria-label={playing ? 'Hold propagation' : 'Resume propagation'}
          title={playing ? 'Hold (Space)' : 'Resume (Space)'}
        >
          <span className={styles.transportIcon}>
            {playing ? <PauseIcon size={13} /> : <PlayIcon size={13} />}
          </span>
          <span className={styles.transportLabel}>{playing ? 'Hold' : 'Run'}</span>
        </button>

        <div className={styles.clock}>
          <span className="hud-label">Met</span>
          <span className={styles.clockValue}>
            <StatusDot tone={playing ? 'green' : 'amber'} pulse={playing} />
            {formatElapsedYears(elapsedYears)}
            <span className={styles.clockUnit}>earth yr</span>
          </span>
        </div>

        <div className={styles.rate}>
          <label
            className="hud-label"
            htmlFor={sliderId}
            title={`Propagation rate. At 1×, one Earth year takes ${YEAR_SECONDS}s.`}
          >
            Rate
          </label>

          {/* The input snaps to nine detents but a bare range reads as
              continuous, so the stops are drawn under the track. */}
          <div className={styles.track}>
            <input
              id={sliderId}
              type="range"
              className={styles.slider}
              min={0}
              max={SPEED_MAX}
              step={1}
              value={speedIndex}
              onChange={(event) => setSpeedIndex(event.currentTarget.valueAsNumber)}
              // Without this the slider announces its raw index, not the speed.
              aria-valuetext={`${multiplier} speed`}
            />
            <span className={styles.ticks} aria-hidden="true">
              {SPEED_STEPS.map((step, index) => (
                <span
                  key={step}
                  className={index === DEFAULT_SPEED_INDEX ? styles.tickHome : styles.tick}
                />
              ))}
            </span>
          </div>

          <output className={styles.rateValue} aria-hidden="true">
            {multiplier}
          </output>
        </div>

        <button
          type="button"
          className={styles.reset}
          onClick={resetView}
          aria-label="Reset the camera to the system overview"
          title="Reset view (Esc)"
        >
          <ResetIcon size={14} />
        </button>
      </div>
    </main>
  );
});
