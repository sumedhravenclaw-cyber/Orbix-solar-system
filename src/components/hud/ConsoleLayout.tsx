import { memo, type CSSProperties, type ReactNode } from 'react';

import { useSimulationState } from '../../state/contexts';
import { CataloguePanel } from './CataloguePanel';
import { IdentityBlock } from './IdentityBlock';
import { LayerPanel } from './LayerPanel';
import { SystemMap } from './SystemMap';
import { TargetReadout } from './TargetReadout';
import styles from './ConsoleLayout.module.css';

/**
 * The console frame: two rails flanking the 3D view.
 *
 * The grid itself is `pointer-events: none` and only the panels re-enable it,
 * so every pixel of empty rail is still draggable scene. A HUD that swallows
 * pointer events over its own gutters is the classic mistake here.
 */

const HINTS: readonly (readonly [string, string])[] = [
  ['Drag', 'orbit'],
  ['Scroll', 'zoom'],
  ['Click', 'acquire'],
  ['Space', 'hold'],
  ['Esc', 'release'],
  ['/', 'search'],
];

const Slot = ({
  index,
  side = 'left',
  children,
}: {
  index: number;
  side?: 'left' | 'right';
  children: ReactNode;
}) => (
  <div
    className={side === 'left' ? styles.slot : styles.slotRight}
    style={{ '--index': index } as CSSProperties}
  >
    {children}
  </div>
);

export const ConsoleLayout = memo(function ConsoleLayout() {
  const { phase } = useSimulationState();
  if (phase !== 'ready') return null;

  return (
    <div className={styles.hud}>
      <div className={styles.rail}>
        <Slot index={0}>
          <IdentityBlock />
        </Slot>
        <Slot index={1}>
          <SystemMap />
        </Slot>
        <Slot index={2}>
          <LayerPanel />
        </Slot>

        <div className={styles.hints}>
          {HINTS.map(([key, action]) => (
            <span key={key} className={styles.hint}>
              <kbd className={styles.key}>{key}</kbd>
              {action}
            </span>
          ))}
        </div>
      </div>

      {/* Centre column is intentionally empty — it is the viewport. */}
      <div aria-hidden="true" />

      <div className={styles.railRight}>
        <Slot index={1} side="right">
          <TargetReadout />
        </Slot>
        <Slot index={2} side="right">
          <CataloguePanel />
        </Slot>
      </div>
    </div>
  );
});
