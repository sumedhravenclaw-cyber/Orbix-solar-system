import { memo, useCallback } from 'react';

import { BODIES, type BodyKey } from '../data/bodies';
import { MOONS } from '../data/moons';
import { useTelemetry } from '../hooks/useTelemetry';
import { useSimulationActions, useSimulationState } from '../state/contexts';
import styles from './BodyLabels.module.css';

/**
 * Floating body names, projected from 3D.
 *
 * The division of labour is the important part: **React owns these DOM nodes,
 * the engine owns their position.** React renders the spans exactly once; the
 * render loop then writes `transform` and `opacity` on them directly each frame
 * via the ref callback below.
 *
 * Moon labels are rendered up front too and left at opacity 0 — the engine
 * reveals them when a satellite system resolves. Mounting them on demand would
 * mean a React render in the middle of a camera move.
 */

const ALL_LABELS: readonly { key: BodyKey; name: string; moon: boolean }[] = [
  ...BODIES.map((body) => ({ key: body.key as BodyKey, name: body.name, moon: false })),
  ...MOONS.map((moon) => ({ key: moon.key as BodyKey, name: moon.name, moon: true })),
];

export const BodyLabels = memo(function BodyLabels() {
  const { registerLabel } = useSimulationActions();
  const { selectedKey, phase } = useSimulationState();
  const { hoveredKey } = useTelemetry();

  if (phase !== 'ready') return null;

  return (
    <div className={styles.layer} aria-hidden="true">
      {ALL_LABELS.map((entry) => (
        <Label
          key={entry.key}
          bodyKey={entry.key}
          name={entry.name}
          moon={entry.moon}
          active={hoveredKey === entry.key || selectedKey === entry.key}
          register={registerLabel}
        />
      ))}
    </div>
  );
});

interface LabelProps {
  bodyKey: BodyKey;
  name: string;
  moon: boolean;
  active: boolean;
  register: (key: BodyKey, element: HTMLElement | null) => void;
}

const Label = memo(function Label({ bodyKey, name, moon, active, register }: LabelProps) {
  // A ref *callback* rather than useEffect: it fires on attach and again with
  // null on detach, which is exactly the register/unregister pair the engine
  // needs, with no dependency array to get wrong.
  const ref = useCallback(
    (element: HTMLSpanElement | null) => {
      register(bodyKey, element);
    },
    [bodyKey, register],
  );

  return (
    <span ref={ref} className={styles.label} data-active={active} data-moon={moon}>
      {name}
    </span>
  );
});
