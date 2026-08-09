import { memo } from 'react';

import { BODY_BY_KEY } from '../../data/bodies';
import { useTelemetry } from '../../hooks/useTelemetry';
import { useSimulationActions, useSimulationState } from '../../state/contexts';
import { Panel, PanelHeading } from './Primitives';
import styles from './SystemMap.module.css';

/**
 * Overhead plan view of the whole system — ORBIX's ground track, reworked for
 * a solar system.
 *
 * The 3D view is a perspective camera that can end up anywhere; this is the
 * fixed, unambiguous answer to "where is everything right now". It is also the
 * only place you can see the outer planets while zoomed in on Earth.
 *
 * Drawn as SVG because there are nine points: a second WebGL context or a
 * canvas would cost more than the elements themselves.
 */

const VIEW = 100; // viewBox is −VIEW … +VIEW on both axes

/** Log compression again, so Mercury is not welded to the Sun at this size. */
const RING_RADII = [21, 25, 27, 31, 44, 52, 62, 69];

export const SystemMap = memo(function SystemMap() {
  const { plot } = useTelemetry();
  const { selectedKey, phase } = useSimulationState();
  const { select } = useSimulationActions();

  if (phase !== 'ready') return null;

  return (
    <Panel label="System plan view" className={styles.panel}>
      <PanelHeading>Plan view · ecliptic</PanelHeading>

      <svg
        className={styles.map}
        viewBox={`${-VIEW} ${-VIEW} ${VIEW * 2} ${VIEW * 2}`}
        role="img"
        aria-label={`Overhead map of the solar system showing ${plot.length} planets in their current positions.`}
      >
        {/* Reference rings, one per planetary orbit. */}
        {RING_RADII.map((radius) => (
          <circle
            key={radius}
            className={styles.ring}
            cx={0}
            cy={0}
            r={radius}
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {/* Cross-hairs for orientation. */}
        <line className={styles.axis} x1={-VIEW} y1={0} x2={VIEW} y2={0} />
        <line className={styles.axis} x1={0} y1={-VIEW} x2={0} y2={VIEW} />

        <circle className={styles.sun} cx={0} cy={0} r={4} />

        {plot.map((point) => {
          const datum = BODY_BY_KEY.get(point.key);
          if (!datum) return null;

          const isSelected =
            selectedKey === point.key ||
            (typeof selectedKey === 'string' && selectedKey.startsWith(`${point.key}:`));

          return (
            <g key={point.key}>
              {isSelected && (
                <circle
                  className={styles.halo}
                  cx={point.x * VIEW}
                  cy={point.y * VIEW}
                  r={7}
                />
              )}
              <circle
                className={styles.blip}
                cx={point.x * VIEW}
                cy={point.y * VIEW}
                r={isSelected ? 4 : 2.6}
                fill={datum.swatch}
              />
            </g>
          );
        })}
      </svg>

      {/* The map is an image to assistive tech; this is the operable path to
          the same information. */}
      <ul className={styles.legend}>
        {plot.map((point) => {
          const datum = BODY_BY_KEY.get(point.key);
          if (!datum) return null;
          const range = Math.hypot(point.x, point.y);
          return (
            <li key={point.key}>
              <button
                type="button"
                className={styles.legendItem}
                aria-pressed={selectedKey === point.key}
                onClick={() => select(selectedKey === point.key ? null : point.key)}
              >
                <span className={styles.swatch} style={{ background: datum.swatch }} />
                <span className={styles.legendName}>{datum.name}</span>
                <span className={styles.legendRange}>{(range * 30.07).toFixed(1)} au</span>
              </button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
});
