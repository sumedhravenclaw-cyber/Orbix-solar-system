/**
 * The body catalogue — pure data, zero Three.js.
 *
 * Physical figures are real (NASA planetary fact sheets); only the *rendered*
 * distances and radii are compressed, and that happens in `engine/scale.ts`.
 * Keeping this file free of rendering concerns means it can be unit-tested,
 * rendered as a table, or swapped for an API response without touching the 3D
 * layer.
 */

export type PlanetKey =
  | 'sun'
  | 'mercury'
  | 'venus'
  | 'earth'
  | 'mars'
  | 'jupiter'
  | 'saturn'
  | 'uranus'
  | 'neptune';

/** Moons are addressed as `parent:moon`, e.g. `jupiter:europa`. */
export type MoonKey = `${PlanetKey}:${string}`;

export type BodyKey = PlanetKey | MoonKey;

/** Shared surface archetypes, so 15 moons need only three textures. */
export type MoonKind = 'rock' | 'ice' | 'sulphur';

export interface MoonDatum {
  readonly key: MoonKey;
  readonly name: string;
  readonly parent: PlanetKey;
  readonly kind: MoonKind;
  /** Mean radius, km. */
  readonly radiusKm: number;
  /** Semi-major axis about its parent, km. */
  readonly axisKm: number;
  /** Sidereal period in Earth days; negative = retrograde. */
  readonly periodDays: number;
  /** Orbital inclination to the parent's equator, degrees. */
  readonly incl: number;
  readonly swatch: string;
  readonly note: string;
}

/** Which procedural painter renders the surface. */
export type SurfaceKind = 'star' | 'rocky' | 'earth' | 'gas';

export interface SurfaceSpec {
  readonly kind: SurfaceKind;
  /** Colour ramp, dark → light, sampled by the noise field. */
  readonly palette: readonly string[];
  /** Gas giants: number of latitude belts. */
  readonly bands?: number;
  /** Gas giants: how much turbulence warps those belts. */
  readonly swirl?: number;
  /** Rocky worlds: how many impact craters to stamp. */
  readonly craters?: number;
  /** Fractional latitude covered by polar ice (0 = none). */
  readonly caps?: number;
  /** A Great-Red-Spot style anticyclone. */
  readonly spot?: 'light' | 'dark';
}

export interface RingSpec {
  /** Inner/outer radius as a multiple of the planet's own radius. */
  readonly inner: number;
  readonly outer: number;
  readonly faint?: boolean;
}

export interface BodyDatum {
  readonly key: PlanetKey;
  readonly name: string;
  readonly type: string;
  /** Semi-major axis in astronomical units (0 for the Sun). */
  readonly au: number;
  /** Sidereal orbital period in Earth years (0 for the Sun). */
  readonly periodYr: number;
  /** Equatorial radius, Earth = 1. */
  readonly earths: number;
  readonly diameterKm: number;
  readonly ecc: number;
  /** Inclination to the ecliptic, degrees. */
  readonly incl: number;
  /** Axial tilt, degrees. */
  readonly tilt: number;
  /** Sidereal rotation in Earth days; negative = retrograde. */
  readonly rotDays: number;
  readonly moons: string;
  /** UI accent for this body (chips, orbit line, card swatch). */
  readonly swatch: string;
  readonly surface: SurfaceSpec;
  readonly rings?: RingSpec;
  /** Atmospheric rim colour; omit for airless bodies (no scattering shell). */
  readonly atmosphere?: string;
  readonly blurb: string;
}

export const BODIES: readonly BodyDatum[] = [
  {
    key: 'sun',
    name: 'Sun',
    type: 'G2V main-sequence star',
    au: 0,
    periodYr: 0,
    earths: 109.2,
    diameterKm: 1_391_400,
    ecc: 0,
    incl: 0,
    tilt: 7.25,
    rotDays: 25.4,
    moons: '—',
    swatch: '#ffb347',
    surface: { kind: 'star', palette: ['#fff6d8', '#ffcf6b', '#ff9a2e', '#e8621b'] },
    blurb:
      'Holds 99.86% of the mass of the solar system. Every orbit on screen is a fall around this point.',
  },
  {
    key: 'mercury',
    name: 'Mercury',
    type: 'Terrestrial planet',
    au: 0.387,
    periodYr: 0.2408,
    earths: 0.383,
    diameterKm: 4_879,
    ecc: 0.206,
    incl: 7.0,
    tilt: 0.03,
    rotDays: 58.65,
    moons: '0',
    swatch: '#9c8f85',
    surface: {
      kind: 'rocky',
      palette: ['#4a423d', '#6e645c', '#9a8d82', '#c3b6a8'],
      craters: 190,
    },
    blurb:
      'Airless, cratered, and locked in a 3:2 spin–orbit resonance. Its year is shorter than two of its days.',
  },
  {
    key: 'venus',
    name: 'Venus',
    type: 'Terrestrial planet',
    au: 0.723,
    periodYr: 0.6152,
    earths: 0.949,
    diameterKm: 12_104,
    ecc: 0.007,
    incl: 3.4,
    tilt: 177.4,
    rotDays: -243.0,
    moons: '0',
    swatch: '#e8c98a',
    atmosphere: '#f3d9a4',
    surface: {
      kind: 'gas',
      palette: ['#8a6a33', '#c9a463', '#e9d3a1', '#fff3d2'],
      bands: 3.2,
      swirl: 1.4,
    },
    blurb:
      'A runaway greenhouse under sulphuric-acid cloud decks. It turns backwards, and slower than it orbits.',
  },
  {
    key: 'earth',
    name: 'Earth',
    type: 'Terrestrial planet',
    au: 1.0,
    periodYr: 1.0,
    earths: 1.0,
    diameterKm: 12_756,
    ecc: 0.017,
    incl: 0.0,
    tilt: 23.44,
    rotDays: 0.997,
    moons: '1',
    swatch: '#5b9bd5',
    atmosphere: '#6fb2ff',
    surface: {
      kind: 'earth',
      palette: ['#0a2b5c', '#12518f', '#2f7d3a', '#8a7a4a'],
      caps: 0.055,
    },
    blurb:
      'The only body here with liquid surface water — and the reference against which every other size on this screen is measured.',
  },
  {
    key: 'mars',
    name: 'Mars',
    type: 'Terrestrial planet',
    au: 1.524,
    periodYr: 1.881,
    earths: 0.532,
    diameterKm: 6_792,
    ecc: 0.093,
    incl: 1.85,
    tilt: 25.19,
    rotDays: 1.026,
    moons: '2',
    swatch: '#c1502e',
    atmosphere: '#d98b6a',
    surface: {
      kind: 'rocky',
      palette: ['#5e2312', '#9c3f1e', '#c76a3a', '#e3a072'],
      craters: 90,
      caps: 0.05,
    },
    blurb:
      'Rust-red from iron oxide dust, with the tallest volcano and the deepest canyon of any planet.',
  },
  {
    key: 'jupiter',
    name: 'Jupiter',
    type: 'Gas giant',
    au: 5.203,
    periodYr: 11.862,
    earths: 11.21,
    diameterKm: 142_984,
    ecc: 0.049,
    incl: 1.3,
    tilt: 3.13,
    rotDays: 0.414,
    moons: '97',
    swatch: '#d8a06a',
    atmosphere: '#e8c79a',
    surface: {
      kind: 'gas',
      palette: ['#6d4526', '#b07f4e', '#e2c69a', '#f6ead3'],
      bands: 11,
      swirl: 2.6,
      spot: 'light',
    },
    blurb:
      'More massive than every other planet combined. Its cloud bands complete a rotation in under ten hours.',
  },
  {
    key: 'saturn',
    name: 'Saturn',
    type: 'Gas giant',
    au: 9.537,
    periodYr: 29.457,
    earths: 9.45,
    diameterKm: 120_536,
    ecc: 0.057,
    incl: 2.49,
    tilt: 26.73,
    rotDays: 0.444,
    moons: '274',
    swatch: '#e3cf9a',
    atmosphere: '#f0e2b8',
    surface: {
      kind: 'gas',
      palette: ['#8a6f3c', '#c4a86e', '#e7d8ac', '#fbf3dc'],
      bands: 8,
      swirl: 1.5,
    },
    rings: { inner: 1.35, outer: 2.2 },
    blurb:
      'Less dense than water. Its ring system is only tens of metres thick but spans two-thirds of the Earth–Moon distance.',
  },
  {
    key: 'uranus',
    name: 'Uranus',
    type: 'Ice giant',
    au: 19.191,
    periodYr: 84.011,
    earths: 4.01,
    diameterKm: 51_118,
    ecc: 0.046,
    incl: 0.77,
    tilt: 97.77,
    rotDays: -0.718,
    moons: '28',
    swatch: '#8fdcdc',
    atmosphere: '#9fe6ea',
    surface: {
      kind: 'gas',
      palette: ['#2e7c86', '#57aab2', '#96d6da', '#cdeef0'],
      bands: 5,
      swirl: 0.7,
    },
    rings: { inner: 1.6, outer: 2.0, faint: true },
    blurb:
      'Tipped 98° onto its side, most likely by an ancient collision, so it rolls along its orbit rather than spinning upright.',
  },
  {
    key: 'neptune',
    name: 'Neptune',
    type: 'Ice giant',
    au: 30.07,
    periodYr: 164.79,
    earths: 3.88,
    diameterKm: 49_528,
    ecc: 0.011,
    incl: 1.77,
    tilt: 28.32,
    rotDays: 0.671,
    moons: '16',
    swatch: '#4f6fe0',
    atmosphere: '#7c9cf0',
    surface: {
      kind: 'gas',
      palette: ['#17287a', '#2c48b8', '#5f83e0', '#a9c1f4'],
      bands: 6,
      swirl: 1.1,
      spot: 'dark',
    },
    blurb:
      'The windiest planet known — supersonic storms exceed 2,000 km/h. It has completed one orbit since its 1846 discovery.',
  },
] as const;

/** O(1) lookup by key — built once at module load. */
export const BODY_BY_KEY: ReadonlyMap<BodyKey, BodyDatum> = new Map(
  BODIES.map((body) => [body.key, body]),
);

/** Everything except the Sun, in orbital order. */
export const PLANETS: readonly BodyDatum[] = BODIES.filter((body) => body.key !== 'sun');
