import { memo } from 'react';

import { useSimulationState } from '../state/contexts';
import styles from './ErrorPanel.module.css';

/**
 * Failure state.
 *
 * Realistically this is "WebGL is unavailable" — a blocked context, a
 * blacklisted driver, or hardware acceleration switched off. An error message
 * has to say what went wrong *and* offer a way forward, so this names the
 * likely cause and gives a retry rather than leaving a black screen.
 */
export const ErrorPanel = memo(function ErrorPanel() {
  const { phase, errorMessage } = useSimulationState();
  if (phase !== 'error') return null;

  return (
    <div className={styles.overlay} role="alert">
      <div className={styles.panel}>
        <h2 className={styles.title}>Cannot start the renderer</h2>

        <p className={styles.message}>
          ORBIX SOL needs WebGL. This usually means hardware acceleration is turned off in
          your browser settings, or the current graphics driver is blocked.
        </p>

        {errorMessage && <p className={styles.detail}>{errorMessage}</p>}

        <button
          type="button"
          className={styles.action}
          onClick={() => window.location.reload()}
        >
          Reload and retry
        </button>
      </div>
    </div>
  );
});
