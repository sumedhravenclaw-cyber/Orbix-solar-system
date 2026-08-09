import { memo } from 'react';

import { useTelemetry } from '../../hooks/useTelemetry';
import { useSimulationState } from '../../state/contexts';
import { StatusDot } from './Primitives';
import styles from './IdentityBlock.module.css';

/**
 * Console identity and health.
 *
 * The frame-rate readout is not decoration: this is a real-time renderer, and
 * an operator needs to know whether what they are watching is running at speed
 * or crawling. It changes colour *and* wording, never colour alone.
 */
export const IdentityBlock = memo(function IdentityBlock() {
  const { phase, playing } = useSimulationState();
  const { fps } = useTelemetry();

  if (phase !== 'ready') return null;

  const health = fps >= 50 ? 'nominal' : fps >= 30 ? 'degraded' : 'strained';
  const tone = fps >= 50 ? 'green' : fps >= 30 ? 'amber' : 'red';

  return (
    <div className={styles.identity}>
      <span className={styles.mark} aria-hidden="true">
        <svg viewBox="0 0 32 32" width="26" height="26" fill="none">
          <circle cx="16" cy="16" r="5" fill="var(--amber)" />
          <ellipse
            cx="16"
            cy="16"
            rx="13.5"
            ry="6"
            stroke="var(--cyan)"
            strokeWidth="1.4"
            transform="rotate(-22 16 16)"
          />
        </svg>
      </span>

      <div className={styles.text}>
        <h1 className={styles.wordmark}>
          ORBIX<span className={styles.divider}>·</span>SOL
        </h1>
        <p className={styles.status}>
          <StatusDot tone={tone} pulse={playing} />
          <span className={styles.statusText}>
            {playing ? 'Propagating' : 'Holding'} · {health}
          </span>
          <span className={styles.fps}>{fps} fps</span>
        </p>
      </div>
    </div>
  );
});
