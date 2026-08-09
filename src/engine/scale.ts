/**
 * Scale model — pure functions, no Three.js, trivially testable.
 *
 * Real distances span 0.39 → 30.07 AU (77×) and real radii span 2,440 →
 * 69,911 km (29×). Rendering either faithfully makes the inner system a dot,
 * so both are compressed:
 *
 *   distance → logarithmic  (77× becomes ~3.3×)
 *   radius   → power law    (29× becomes ~3.8×)
 *
 * Angular velocity is deliberately NOT compressed: ω = 2π / period, so the
 * period *ratios* between planets stay exactly right.
 *
 * The coefficients below are tuned so no two bodies' discs can overlap even at
 * closest alignment, while Neptune's orbit still fits the default frame.
 */

/** Scene units from the Sun for a given semi-major axis in AU. */
export const orbitRadius = (au: number): number => 15 + 36 * Math.log10(1 + au);

/** Scene-unit sphere radius for a body sized in Earth radii. */
export const bodyRadius = (earths: number): number => 1.02 * Math.pow(earths, 0.4);

/**
 * One Earth year, in real seconds, at 1× speed.
 *
 * 24s is a deliberately unhurried baseline: it puts Mercury at ~5.8s per lap
 * and Earth at 24s, slow enough to *watch* an orbit rather than register a
 * blur. Anyone wanting the brisk survey pace has 2× and 5× a notch away.
 */
export const YEAR_SECONDS = 24;

/**
 * One Earth day, in real seconds, at 1× speed.
 *
 * Spin runs on its own clock. At the true 1:365 ratio Earth would complete a
 * rotation every 27ms — a strobe, not a planet. Relative spin rates between
 * bodies are still preserved.
 *
 * Held at ~1/5 of a year rather than the year's full 2.4× slowdown: terminators
 * sweeping visibly is what makes the globes read as lit spheres, so spin is
 * calmed less aggressively than orbit.
 */
export const DAY_SECONDS = 5;

/** Sun radius in scene units (it is not on the planetary size curve). */
export const SUN_RADIUS = 6;

/** Orbital angular velocity in radians per simulated second. */
export const angularVelocity = (periodYr: number): number =>
  periodYr === 0 ? 0 : (Math.PI * 2) / (periodYr * YEAR_SECONDS);

/** Axial spin in radians per simulated second; sign encodes retrograde. */
export const spinVelocity = (rotDays: number): number =>
  rotDays === 0 ? 0 : (Math.PI * 2) / (DAY_SECONDS * Math.abs(rotDays)) * Math.sign(rotDays);

/**
 * Point on the orbital ellipse for a parameter angle.
 *
 * The Sun sits at a focus, so the ellipse is offset by `a * e` along +x. The
 * orbit line is sampled from this exact function too, which is why a planet can
 * never visually drift off its own track.
 */
export interface EllipseGeometry {
  /** Semi-major axis, scene units. */
  readonly a: number;
  /** Semi-minor axis, scene units. */
  readonly b: number;
  /** Focus offset along +x, scene units. */
  readonly focusOffset: number;
}

export const ellipseFor = (au: number, ecc: number): EllipseGeometry => {
  const a = orbitRadius(au);
  return {
    a,
    b: a * Math.sqrt(1 - ecc * ecc),
    focusOffset: a * ecc,
  };
};

export const ellipsePoint = (
  { a, b, focusOffset }: EllipseGeometry,
  theta: number,
): { x: number; z: number } => ({
  x: Math.cos(theta) * a - focusOffset,
  z: Math.sin(theta) * b,
});

/**
 * Default camera distance, widened on narrow viewports so Neptune's orbit
 * still fits horizontally. Returns a multiplier applied to the home position.
 */
export const framingPull = (aspect: number): number =>
  Math.min(2.05, Math.max(1, 1.65 / aspect));

/* ==========================================================================
   Satellite scale
   --------------------------------------------------------------------------
   Moons need their own compression curve. The real size ratios are brutal:
   the Moon is 0.27 of Earth, but Phobos is 0.0033 of Mars — a faithful Phobos
   would be a third of a pixel. And real orbits are worse: Iapetus sits 61
   Saturn-radii out, which at planetary compression would sweep across two
   neighbouring planetary lanes.

   So moon radius and orbit are both compressed hard against their *parent*,
   and the engine only reveals a moon system when its parent is the focus.
   ========================================================================== */

/** Rendered moon radius, in scene units, from the real size ratio. */
export const moonRadius = (moonKm: number, planetKm: number, planetRadius: number): number => {
  const ratio = moonKm / planetKm;
  const compressed = 0.42 * Math.pow(ratio, 0.35);
  return planetRadius * Math.min(0.34, Math.max(0.05, compressed));
};

/**
 * Rendered orbital radius of a moon about its parent, in scene units.
 *
 * Clamped so the outermost moon never strays more than ~4.6 parent radii out,
 * which keeps every moon system inside its planet's own visual envelope.
 */
export const moonOrbitRadius = (
  axisKm: number,
  planetKm: number,
  planetRadius: number,
  ringOuter = 0,
): number => {
  const axisInParentRadii = axisKm / (planetKm / 2);
  const compressed = 1.9 + 1.05 * Math.log10(1 + axisInParentRadii);
  // Never inside the planet, and never inside a ring system.
  const floor = Math.max(1.75, ringOuter * 1.18);
  return planetRadius * Math.min(4.6, Math.max(floor, compressed));
};

/** Moon angular velocity in radians per simulated second. */
export const moonAngularVelocity = (periodDays: number): number =>
  periodDays === 0
    ? 0
    : ((Math.PI * 2) / ((Math.abs(periodDays) / 365.25) * YEAR_SECONDS)) * Math.sign(periodDays);
