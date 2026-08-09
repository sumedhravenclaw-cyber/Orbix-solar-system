import { memo } from 'react';

import { useSimulationState, useStageRef } from '../state/contexts';
import styles from './Viewport.module.css';

/**
 * The WebGL stage.
 *
 * React renders an empty container and hands it to the provider; the engine
 * creates, sizes and destroys the <canvas> inside it. That boundary matters:
 * disposing a renderer force-loses its GL context, and a force-lost canvas can
 * never serve a new one — so the canvas has to live and die with the engine
 * rather than with the component. Sharing one canvas across mounts breaks on
 * the second mount, which StrictMode performs on every dev reload.
 *
 * `aria-hidden`: the scene is decorative to assistive technology, and every
 * body in it is reachable through the labelled controls in the dock.
 */
export const Viewport = memo(function Viewport() {
  const stageRef = useStageRef();
  const { phase } = useSimulationState();

  return (
    <div className={styles.viewport}>
      <div
        ref={stageRef}
        className={styles.stage}
        data-ready={phase === 'ready'}
        aria-hidden="true"
      />
      <div className={styles.atmosphere} aria-hidden="true" />
    </div>
  );
});
