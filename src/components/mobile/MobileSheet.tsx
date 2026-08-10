import { memo, useState } from 'react';

import { useSimulationState } from '../../state/contexts';
import { SpaceAssistant } from '../assistant/SpaceAssistant';
import { CataloguePanel } from '../hud/CataloguePanel';
import { LayerPanel } from '../hud/LayerPanel';
import { SystemMap } from '../hud/SystemMap';
import { TargetReadout } from '../hud/TargetReadout';
import { LayersIcon, MapIcon, SearchIcon } from '../icons/Icons';
import styles from './MobileSheet.module.css';

/**
 * Small-screen console.
 *
 * The two desktop rails cannot coexist with a usable 3D view under ~68rem, so
 * the secondary panels collapse into one bottom sheet with three tabs. Nothing
 * is lost — every panel is still reachable, which is why the rails can be
 * hidden rather than crammed.
 *
 * The target readout is *not* a tab: an acquired target is the one thing that
 * should surface without being asked for, so it rides above the tab row
 * whenever something is selected.
 *
 * Rendered on every viewport and hidden with CSS rather than switched on a JS
 * media query — no hydration flash, no resize listener, and the breakpoint
 * lives in one place.
 */

type SheetTab = 'map' | 'catalogue' | 'layers';

const TABS: readonly { id: SheetTab; label: string; Icon: typeof MapIcon }[] = [
  { id: 'map', label: 'Plan', Icon: MapIcon },
  { id: 'catalogue', label: 'Bodies', Icon: SearchIcon },
  { id: 'layers', label: 'Layers', Icon: LayersIcon },
];

export const MobileSheet = memo(function MobileSheet() {
  const { phase, selectedKey } = useSimulationState();
  const [open, setOpen] = useState<SheetTab | null>(null);

  if (phase !== 'ready') return null;

  return (
    <div className={styles.sheet}>
      {selectedKey && open === null && (
        <div className={styles.body}>
          {/* Same single assistant instance as the desktop rail — this is a
              consumer, not a second conversation. */}
          <SpaceAssistant />
          <TargetReadout />
        </div>
      )}

      {open !== null && (
        <div className={styles.body} id={`sheet-${open}`}>
          {open === 'map' && <SystemMap />}
          {open === 'catalogue' && <CataloguePanel />}
          {open === 'layers' && <LayerPanel />}
        </div>
      )}

      <div className={styles.tabs}>
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={styles.tab}
            aria-expanded={open === id}
            aria-controls={`sheet-${id}`}
            onClick={() => setOpen((current) => (current === id ? null : id))}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
});
