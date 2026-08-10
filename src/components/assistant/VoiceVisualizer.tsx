import { memo } from 'react';

import styles from './SpaceAssistant.module.css';

const BARS = 7;

/**
 * Speaking indicator.
 *
 * Deliberately CSS-driven rather than sampled from the audio graph. The browser
 * speech engine exposes no analyser node at all, so any "reactive" waveform
 * drawn against it would be theatre — and a hosted voice would need a Web Audio
 * graph running at 60fps beside an already-loaded WebGL scene to do it
 * honestly. A staggered CSS pulse says "this is talking" just as clearly for
 * none of the frame budget, and stops dead when speech stops.
 */
export const VoiceVisualizer = memo(function VoiceVisualizer({ active }: { active: boolean }) {
  return (
    <span className={styles.visualizer} data-active={active} aria-hidden="true">
      {Array.from({ length: BARS }, (_, index) => (
        <span key={index} className={styles.bar} />
      ))}
    </span>
  );
});
