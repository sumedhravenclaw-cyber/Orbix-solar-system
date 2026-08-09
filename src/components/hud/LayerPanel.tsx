import { memo } from 'react';

import type { LayerKey } from '../../engine/types';
import { useTelemetry } from '../../hooks/useTelemetry';
import { useSimulationActions, useSimulationState } from '../../state/contexts';
import { LAYER_LABELS } from '../../state/simulation';
import { Panel, PanelHeading, Toggle } from './Primitives';
import styles from './LayerPanel.module.css';

const LAYER_ORDER: readonly LayerKey[] = [
  'orbits',
  'labels',
  'satellites',
  'atmospheres',
  'belt',
];

/**
 * Scene layer switches.
 *
 * The satellite row carries a live count, because "Satellites: on" is not the
 * whole truth — moon systems only resolve when the camera is close enough for
 * them to be more than a pixel. Stating how many are currently drawn explains
 * that rule without a tooltip.
 */
export const LayerPanel = memo(function LayerPanel() {
  const { layers, phase } = useSimulationState();
  const { toggleLayer } = useSimulationActions();
  const { satellitesVisible } = useTelemetry();

  if (phase !== 'ready') return null;

  return (
    <Panel label="Scene layers" className={styles.panel}>
      <PanelHeading>Layers</PanelHeading>

      <div className={styles.stack}>
        {LAYER_ORDER.map((layer) => (
          <Toggle
            key={layer}
            label={LAYER_LABELS[layer]}
            active={layers[layer]}
            onToggle={() => toggleLayer(layer)}
          />
        ))}
      </div>

      <p className={styles.hint}>
        <span className="hud-label">Sats resolved</span>
        <span className={styles.count} data-live={satellitesVisible > 0}>
          {layers.satellites ? satellitesVisible : 'off'}
        </span>
      </p>
      <p className={styles.explain}>
        Moon systems resolve as the camera closes on their primary.
      </p>
    </Panel>
  );
});
