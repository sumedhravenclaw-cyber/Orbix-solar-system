import { memo, useEffect, useState, type CSSProperties } from 'react';

import { useSimulationState } from '../../state/contexts';
import styles from './BootScreen.module.css';

/**
 * Boot sequence.
 *
 * Determinate, because the engine can report a real fraction — an
 * indeterminate spinner tells the user nothing about whether progress is being
 * made. It also keeps a short log of completed stages, which turns a ~1s wait
 * into something legible rather than a blank hold.
 *
 * Fades rather than unmounting instantly, then removes itself once the
 * transition has finished.
 */
export const BootScreen = memo(function BootScreen() {
  const { phase, progress, stage } = useSimulationState();
  const [mounted, setMounted] = useState(true);
  const [log, setLog] = useState<string[]>([]);

  // Append each distinct stage as it arrives, keeping the last five. Done in an
  // effect, not during render — a render-phase write is a side effect and can
  // be discarded or replayed.
  useEffect(() => {
    if (!stage) return;
    setLog((entries) => (entries.at(-1) === stage ? entries : [...entries, stage].slice(-5)));
  }, [stage]);

  const done = phase === 'ready';

  useEffect(() => {
    if (!done) return;
    const timer = window.setTimeout(() => setMounted(false), 700);
    return () => window.clearTimeout(timer);
  }, [done]);

  if (!mounted || phase === 'error') return null;

  const percent = Math.round(progress * 100);

  return (
    <div className={styles.screen} data-done={done} role="status" aria-busy={!done}>
      <div className={styles.frame}>
        <span className={styles.mark} aria-hidden="true">
          <svg viewBox="0 0 64 64" width="52" height="52" fill="none">
            <circle cx="32" cy="32" r="9" fill="var(--amber)" />
            <ellipse
              cx="32"
              cy="32"
              rx="27"
              ry="12"
              stroke="var(--cyan)"
              strokeWidth="1.4"
              transform="rotate(-22 32 32)"
              className={styles.orbit}
            />
            <ellipse
              cx="32"
              cy="32"
              rx="20"
              ry="8"
              stroke="var(--line-strong)"
              strokeWidth="1"
              transform="rotate(18 32 32)"
            />
          </svg>
        </span>

        <p className={styles.wordmark}>
          ORBIX<span className={styles.divider}>·</span>SOL
        </p>
        <p className={styles.subtitle}>Heliocentric propagation console</p>

        <div
          className={styles.track}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label="Building the scene"
        >
          <span className={styles.fill} style={{ '--progress': progress } as CSSProperties} />
        </div>

        {/* aria-live on the stage line only: announcing every percent tick
            would flood a screen reader. */}
        <p className={styles.stage} aria-live="polite">
          <span className={styles.percent}>{String(percent).padStart(3, '0')}%</span>
          {stage}
        </p>

        <ul className={styles.log} aria-hidden="true">
          {log.map((entry) => (
            <li key={entry}>{entry}</li>
          ))}
        </ul>
      </div>
    </div>
  );
});
