import { memo, useEffect, useState } from 'react';

import { BODY_BY_KEY, type BodyDatum, type MoonDatum, type PlanetKey } from '../../data/bodies';
import { MOON_BY_KEY, satellitesOf } from '../../data/moons';
import {
  describeBody,
  formatDiameter,
  formatDistance,
  formatMoonPeriod,
  formatPeriod,
  formatRange,
  formatRelativeSize,
  formatRotation,
} from '../../lib/format';
import { useTelemetry } from '../../hooks/useTelemetry';
import { useSimulationActions, useSimulationState } from '../../state/contexts';
import { CloseIcon } from '../icons/Icons';
import { Panel, PanelHeading, Readout, StatusDot } from './Primitives';
import styles from './TargetReadout.module.css';

/**
 * The acquired target.
 *
 * Stays mounted and animates on `data-open`, so it can animate *out* as well as
 * in, and keeps rendering the last target through the exit so the panel never
 * empties while it is still visible.
 */
export const TargetReadout = memo(function TargetReadout() {
  const { selectedKey, phase } = useSimulationState();
  const { select } = useSimulationActions();
  const { focusRange } = useTelemetry();

  const [displayed, setDisplayed] = useState<Resolved | null>(null);

  useEffect(() => {
    if (!selectedKey) return;
    const resolved = resolve(selectedKey);
    if (resolved) setDisplayed(resolved);
  }, [selectedKey]);

  const open = phase === 'ready' && selectedKey !== null && displayed !== null;

  return (
    <div className={styles.wrapper} data-open={open} inert={!open || undefined}>
      {displayed && (
        <Panel label={`${displayed.name} target readout`} className={styles.panel}>
          <PanelHeading
            action={
              <button
                type="button"
                className={styles.close}
                onClick={() => select(null)}
                aria-label={`Release ${displayed.name}`}
                title="Release target (Esc)"
              >
                <CloseIcon size={13} />
              </button>
            }
          >
            Target acquired
          </PanelHeading>

          {/* One announcement of the whole target, rather than five field
              updates racing each other. */}
          <p className="sr-only" aria-live="polite">
            {open ? displayed.description : ''}
          </p>

          <div className={styles.title}>
            <span
              className={styles.swatch}
              style={{ background: displayed.swatch }}
              aria-hidden="true"
            />
            <div className={styles.titleText}>
              <p className={styles.name}>{displayed.name}</p>
              <p className={styles.classification}>{displayed.classification}</p>
            </div>
          </div>

          <div className={styles.grid}>
            {displayed.readouts.map((readout, index) => (
              <div
                key={readout.label}
                className={styles.cell}
                style={{ '--index': index } as React.CSSProperties}
              >
                <Readout {...readout} />
              </div>
            ))}
          </div>

          {focusRange !== null && (
            <p className={styles.range}>
              <StatusDot tone="cyan" pulse />
              <span className="hud-label">Camera range</span>
              <span className={styles.rangeValue}>{formatRange(focusRange)}</span>
            </p>
          )}

          {displayed.satellites.length > 0 && (
            <div className={styles.satellites}>
              <PanelHeading>Natural satellites · {displayed.satellites.length}</PanelHeading>
              <ul className={styles.satelliteList}>
                {displayed.satellites.map((moon, index) => (
                  <li key={moon.key} style={{ '--index': index } as React.CSSProperties}>
                    <button
                      type="button"
                      className={styles.satellite}
                      aria-pressed={selectedKey === moon.key}
                      onClick={() => select(selectedKey === moon.key ? null : moon.key)}
                    >
                      <span
                        className={styles.satelliteDot}
                        style={{ background: moon.swatch }}
                        aria-hidden="true"
                      />
                      <span className={styles.satelliteName}>{moon.name}</span>
                      <span className={styles.satellitePeriod}>
                        {formatMoonPeriod(moon.periodDays)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {displayed.note && <p className={styles.note}>{displayed.note}</p>}
        </Panel>
      )}
    </div>
  );
});

/* ==========================================================================
   Resolution: a target is either a planet or a moon, and the panel renders
   both from one shape.
   ========================================================================== */

interface Resolved {
  readonly name: string;
  readonly classification: string;
  readonly swatch: string;
  readonly description: string;
  readonly note: string;
  readonly readouts: readonly {
    label: string;
    value: string;
    unit?: string;
    tone?: 'cyan' | 'amber' | 'mute' | 'violet';
  }[];
  readonly satellites: readonly MoonDatum[];
}

function resolve(key: string): Resolved | null {
  const planet = BODY_BY_KEY.get(key as PlanetKey);
  if (planet) return fromPlanet(planet);

  const moon = MOON_BY_KEY.get(key as `${PlanetKey}:${string}`);
  if (moon) return fromMoon(moon);

  return null;
}

function fromPlanet(datum: BodyDatum): Resolved {
  const satellites = satellitesOf(datum.key);
  return {
    name: datum.name,
    classification: datum.type,
    swatch: datum.swatch,
    description: describeBody(datum),
    note: datum.blurb,
    readouts: [
      { label: 'Rel. size', value: formatRelativeSize(datum.earths), tone: 'cyan' },
      { label: 'Period', value: formatPeriod(datum.periodYr), tone: 'cyan' },
      { label: 'Sma', value: formatDistance(datum.au) },
      { label: 'Diameter', value: formatDiameter(datum.diameterKm) },
      { label: 'Rotation', value: formatRotation(datum.rotDays) },
      {
        label: 'Tracked sats',
        value: satellites.length === 0 ? '—' : String(satellites.length),
        tone: satellites.length > 0 ? 'violet' : 'mute',
      },
    ],
    satellites,
  };
}

function fromMoon(moon: MoonDatum): Resolved {
  const parent = BODY_BY_KEY.get(moon.parent);
  return {
    name: moon.name,
    classification: `Natural satellite · ${parent?.name ?? moon.parent}`,
    swatch: moon.swatch,
    description:
      `${moon.name}, a natural satellite of ${parent?.name ?? moon.parent}. ` +
      `Radius ${moon.radiusKm} kilometres, orbital period ${formatMoonPeriod(moon.periodDays)}.`,
    note: moon.note,
    readouts: [
      { label: 'Radius', value: `${moon.radiusKm.toLocaleString()}`, unit: 'km', tone: 'cyan' },
      { label: 'Period', value: formatMoonPeriod(moon.periodDays), tone: 'cyan' },
      { label: 'Sma', value: `${(moon.axisKm / 1000).toFixed(0)}k`, unit: 'km' },
      { label: 'Inclination', value: moon.incl.toFixed(2), unit: '°' },
      {
        label: 'Direction',
        value: moon.periodDays < 0 ? 'Retrograde' : 'Prograde',
        tone: moon.periodDays < 0 ? 'amber' : 'mute',
      },
      { label: 'Primary', value: parent?.name ?? '—', tone: 'violet' },
    ],
    satellites: [],
  };
}
