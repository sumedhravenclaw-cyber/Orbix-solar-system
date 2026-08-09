/**
 * Deterministic value noise → fractal Brownian motion.
 *
 * Pure maths, no dependencies. Used to paint every planet surface so the app
 * ships zero image assets. Deterministic (a hash, not Math.random) so the same
 * planet looks identical on every load and across reloads.
 */

/**
 * Hash a 2D integer lattice point into [0, 1).
 *
 * This is the hottest function in the app — roughly thirty calls per painted
 * pixel — so it is worth knowing what has already been tried: a direct-mapped
 * memo on the lattice point is *slower*. Both cylindrical coordinates advance
 * together along a row, so consecutive pixels rarely reuse a lattice corner and
 * the cache bookkeeping costs more than the Math.sin it avoids.
 */
export const hash2 = (x: number, y: number): number => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** Smoothed value noise with a quintic-ish (3t² − 2t³) fade. */
export const valueNoise = (x: number, y: number): number => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;

  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);

  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);

  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};

/** Sum of octaves at halving amplitude / doubling frequency. */
export const fbm = (x: number, y: number, octaves = 4): number => {
  let sum = 0;
  let amplitude = 0.5;
  let frequency = 1;

  for (let i = 0; i < octaves; i += 1) {
    sum += amplitude * valueNoise(x * frequency, y * frequency);
    frequency *= 2;
    amplitude *= 0.5;
  }

  return sum;
};

/**
 * Cylindrical sample coordinates for a spherical UV pair.
 *
 * Both returned components are periodic in `u`, so the noise field wraps
 * seamlessly across the sphere's UV seam instead of showing a visible join.
 */
export const cylindricalSample = (
  u: number,
  v: number,
  scale: number,
  seed: number,
): readonly [number, number] => {
  const theta = u * Math.PI * 2;
  return [Math.cos(theta) * scale + seed, Math.sin(theta) * scale + v * 7 + seed];
};

export type Rgb = readonly [number, number, number];

export const hexToRgb = (hex: string): Rgb => [
  Number.parseInt(hex.slice(1, 3), 16),
  Number.parseInt(hex.slice(3, 5), 16),
  Number.parseInt(hex.slice(5, 7), 16),
];

/** Linear interpolation across a colour ramp; `t` is clamped to [0, 1). */
export const sampleRamp = (ramp: readonly Rgb[], t: number): Rgb => {
  const clamped = Math.min(0.9999, Math.max(0, t));
  const scaled = clamped * (ramp.length - 1);
  const index = Math.floor(scaled);
  const frac = scaled - index;

  const from = ramp[index];
  const to = ramp[Math.min(ramp.length - 1, index + 1)];

  return [
    from[0] + (to[0] - from[0]) * frac,
    from[1] + (to[1] - from[1]) * frac,
    from[2] + (to[2] - from[2]) * frac,
  ];
};
