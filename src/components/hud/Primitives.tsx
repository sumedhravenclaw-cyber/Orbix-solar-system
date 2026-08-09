import { memo, type ReactNode } from 'react';

import styles from './Primitives.module.css';

/**
 * Shared console primitives.
 *
 * Every HUD surface is assembled from these, so the bezel, label and readout
 * language stays identical across panels — the same contract the ORBIX console
 * uses. Panels never style their own borders or labels.
 */

export type Tone = 'amber' | 'cyan' | 'green' | 'red' | 'violet' | 'mute';

const TONE_COLOR: Record<Tone, string> = {
  amber: 'var(--amber)',
  cyan: 'var(--cyan)',
  green: 'var(--green)',
  red: 'var(--red)',
  violet: 'var(--violet)',
  mute: 'var(--ink-mute)',
};

export function Panel({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  /** Accessible name — panels are landmarks, so they need one. */
  label: string;
}) {
  return (
    <section className={`${styles.panel} ${className ?? ''}`} aria-label={label}>
      {children}
    </section>
  );
}

export function PanelHeading({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={styles.heading}>
      <span className={styles.tick} aria-hidden="true" />
      <h2 className={styles.headingLabel}>{children}</h2>
      <span className={styles.headingRule} aria-hidden="true" />
      {action}
    </div>
  );
}

export const StatusDot = memo(function StatusDot({
  tone,
  pulse = false,
}: {
  tone: Tone;
  pulse?: boolean;
}) {
  return (
    <span
      className={`${styles.dot} ${pulse ? 'beacon' : ''}`}
      style={{ background: TONE_COLOR[tone] }}
      aria-hidden="true"
    />
  );
});

export const Readout = memo(function Readout({
  label,
  value,
  unit,
  tone = 'mute',
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: Tone;
}) {
  return (
    <div className={styles.readout}>
      <span className={styles.readoutLabel}>{label}</span>
      <span className={styles.readoutValue} style={{ color: TONE_COLOR[tone] }}>
        {value}
        {unit && <span className={styles.readoutUnit}>{unit}</span>}
      </span>
    </div>
  );
});

/**
 * Layer switch.
 *
 * `aria-pressed` carries the state, and the knob moves as well as changing
 * colour, so "on" is legible without colour vision.
 */
export const Toggle = memo(function Toggle({
  label,
  active,
  onToggle,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button type="button" className={styles.toggle} aria-pressed={active} onClick={onToggle}>
      <span className={styles.switchTrack} aria-hidden="true">
        <span className={styles.switchKnob} />
      </span>
      {label}
    </button>
  );
});
