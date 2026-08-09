import type { BodyDatum } from '../data/bodies';

/**
 * Display formatting.
 *
 * Locale-aware where it matters (thousands separators differ by locale) and
 * pure everywhere, so each rule is one testable function rather than string
 * concatenation scattered through JSX.
 */

const integer = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

/** Relative size against Earth, e.g. "0.383 × Earth" / "11.2 × Earth". */
export const formatRelativeSize = (earths: number): string =>
  `${earths >= 10 ? earths.toFixed(1) : earths.toFixed(3)} × Earth`;

/**
 * Orbital period in whichever unit a human can actually picture: days below
 * about two years, Earth years above it.
 */
export const formatPeriod = (periodYr: number): string => {
  if (periodYr === 0) return '—';
  const days = periodYr * 365.25;
  return days < 700
    ? `${days.toFixed(1)} Earth days`
    : `${periodYr.toFixed(2)} Earth years`;
};

/** Sidereal rotation; sub-day values read better in hours. */
export const formatRotation = (rotDays: number): string => {
  const retrograde = rotDays < 0;
  const magnitude = Math.abs(rotDays);
  const base =
    magnitude < 1.2 ? `${(magnitude * 24).toFixed(1)} h` : `${magnitude.toFixed(1)} d`;
  return retrograde ? `${base} (retrograde)` : base;
};

export const formatDistance = (au: number): string => (au === 0 ? '—' : `${au.toFixed(2)} AU`);

export const formatDiameter = (km: number): string => `${integer.format(km)} km`;

/** Speed multiplier chip, e.g. "0.25×" / "1×" / "20×". */
export const formatSpeed = (multiplier: number): string =>
  `${multiplier < 1 ? multiplier.toFixed(2).replace(/0+$/, '').replace(/\.$/, '') : multiplier}×`;

/** Elapsed mission time for the header clock. */
export const formatElapsedYears = (years: number): string => years.toFixed(2);

/**
 * Satellite period. Moons span 0.32 days (Phobos) to 79 days (Iapetus), so
 * hours below a day and days above it — nobody pictures "0.32 days".
 */
export const formatMoonPeriod = (periodDays: number): string => {
  const magnitude = Math.abs(periodDays);
  const base =
    magnitude < 1 ? `${(magnitude * 24).toFixed(1)} h` : `${magnitude.toFixed(2)} d`;
  return periodDays < 0 ? `${base} ↺` : base;
};

/** Camera stand-off distance, in scene units, for the target readout. */
export const formatRange = (range: number): string =>
  range < 10 ? `${range.toFixed(2)} u` : `${range.toFixed(1)} u`;

/**
 * A screen-reader sentence for a body, so the card is not just a visual table.
 */
export const describeBody = (datum: BodyDatum): string =>
  `${datum.name}, ${datum.type}. ` +
  `Relative size ${formatRelativeSize(datum.earths)}. ` +
  `Orbital period ${formatPeriod(datum.periodYr)}. ` +
  `Mean distance from the Sun ${formatDistance(datum.au)}.`;
