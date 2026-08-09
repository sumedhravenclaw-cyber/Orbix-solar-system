import type { MoonDatum, MoonKey, PlanetKey } from './bodies';

/**
 * Natural satellites — the fifteen that are worth rendering.
 *
 * Figures are real (radius, semi-major axis, sidereal period). As with the
 * planets, only the *rendered* geometry is compressed; see `engine/scale.ts`.
 *
 * Rendering every known moon would be dishonest at this scale — Jupiter's 97
 * are mostly sub-kilometre captured rock. These are the bodies a mission
 * console would actually track.
 */
export const MOONS: readonly MoonDatum[] = [
  // --- Earth ---------------------------------------------------------------
  {
    key: 'earth:moon',
    name: 'Moon',
    parent: 'earth',
    kind: 'rock',
    radiusKm: 1737,
    axisKm: 384_400,
    periodDays: 27.322,
    incl: 5.14,
    swatch: '#c9c7c2',
    note: 'Tidally locked. Receding 3.8 cm per year.',
  },

  // --- Mars ----------------------------------------------------------------
  {
    key: 'mars:phobos',
    name: 'Phobos',
    parent: 'mars',
    kind: 'rock',
    radiusKm: 11.3,
    axisKm: 9_376,
    periodDays: 0.319,
    incl: 1.08,
    swatch: '#8c7d70',
    note: 'Orbits faster than Mars rotates — it rises in the west.',
  },
  {
    key: 'mars:deimos',
    name: 'Deimos',
    parent: 'mars',
    kind: 'rock',
    radiusKm: 6.2,
    axisKm: 23_463,
    periodDays: 1.263,
    incl: 1.79,
    swatch: '#9c8d7e',
    note: 'The smaller, outer moon. Likely a captured asteroid.',
  },

  // --- Jupiter: the Galileans ----------------------------------------------
  {
    key: 'jupiter:io',
    name: 'Io',
    parent: 'jupiter',
    kind: 'sulphur',
    radiusKm: 1821,
    axisKm: 421_700,
    periodDays: 1.769,
    incl: 0.05,
    swatch: '#e8d16a',
    note: 'The most volcanically active body known, flexed by tidal heating.',
  },
  {
    key: 'jupiter:europa',
    name: 'Europa',
    parent: 'jupiter',
    kind: 'ice',
    radiusKm: 1561,
    axisKm: 671_034,
    periodDays: 3.551,
    incl: 0.47,
    swatch: '#d8cbb0',
    note: 'A cracked ice shell over a salt-water ocean twice Earth’s volume.',
  },
  {
    key: 'jupiter:ganymede',
    name: 'Ganymede',
    parent: 'jupiter',
    kind: 'ice',
    radiusKm: 2634,
    axisKm: 1_070_412,
    periodDays: 7.155,
    incl: 0.2,
    swatch: '#a8a29a',
    note: 'The largest moon in the solar system — bigger than Mercury.',
  },
  {
    key: 'jupiter:callisto',
    name: 'Callisto',
    parent: 'jupiter',
    kind: 'rock',
    radiusKm: 2410,
    axisKm: 1_882_709,
    periodDays: 16.689,
    incl: 0.19,
    swatch: '#7e7468',
    note: 'The most heavily cratered surface known; geologically dead.',
  },

  // --- Saturn --------------------------------------------------------------
  {
    key: 'saturn:enceladus',
    name: 'Enceladus',
    parent: 'saturn',
    kind: 'ice',
    radiusKm: 252,
    axisKm: 237_948,
    periodDays: 1.37,
    incl: 0.02,
    swatch: '#eef3f6',
    note: 'Vents water vapour from its south pole into Saturn’s E ring.',
  },
  {
    key: 'saturn:rhea',
    name: 'Rhea',
    parent: 'saturn',
    kind: 'ice',
    radiusKm: 764,
    axisKm: 527_108,
    periodDays: 4.518,
    incl: 0.35,
    swatch: '#cfd4d8',
    note: 'Saturn’s second-largest moon; almost pure water ice.',
  },
  {
    key: 'saturn:titan',
    name: 'Titan',
    parent: 'saturn',
    kind: 'sulphur',
    radiusKm: 2575,
    axisKm: 1_221_870,
    periodDays: 15.945,
    incl: 0.33,
    swatch: '#e0a95c',
    note: 'The only moon with a thick atmosphere, and lakes of liquid methane.',
  },
  {
    key: 'saturn:iapetus',
    name: 'Iapetus',
    parent: 'saturn',
    kind: 'rock',
    radiusKm: 735,
    axisKm: 3_560_820,
    periodDays: 79.32,
    incl: 15.47,
    swatch: '#8e8578',
    note: 'One hemisphere is soot-dark, the other bright ice.',
  },

  // --- Uranus --------------------------------------------------------------
  {
    key: 'uranus:ariel',
    name: 'Ariel',
    parent: 'uranus',
    kind: 'ice',
    radiusKm: 579,
    axisKm: 190_900,
    periodDays: 2.52,
    incl: 0.26,
    swatch: '#c6d6d8',
    note: 'The brightest of the Uranian moons, cut by deep rift valleys.',
  },
  {
    key: 'uranus:titania',
    name: 'Titania',
    parent: 'uranus',
    kind: 'ice',
    radiusKm: 789,
    axisKm: 435_910,
    periodDays: 8.706,
    incl: 0.34,
    swatch: '#b8c6c9',
    note: 'Largest Uranian moon; scarred by a 1,600 km canyon system.',
  },
  {
    key: 'uranus:oberon',
    name: 'Oberon',
    parent: 'uranus',
    kind: 'rock',
    radiusKm: 761,
    axisKm: 583_520,
    periodDays: 13.463,
    incl: 0.06,
    swatch: '#9aa3a6',
    note: 'The outermost major Uranian moon, with dark crater floors.',
  },

  // --- Neptune -------------------------------------------------------------
  {
    key: 'neptune:triton',
    name: 'Triton',
    parent: 'neptune',
    kind: 'ice',
    radiusKm: 1353,
    axisKm: 354_759,
    periodDays: -5.877,
    incl: 156.9,
    swatch: '#cddbe6',
    note: 'Orbits backwards — a captured Kuiper belt object, slowly spiralling in.',
  },
] as const;

/** Moons grouped by parent, built once at module load. */
export const MOONS_BY_PARENT: ReadonlyMap<PlanetKey, readonly MoonDatum[]> = MOONS.reduce(
  (map, moon) => {
    const existing = map.get(moon.parent);
    if (existing) existing.push(moon);
    else map.set(moon.parent, [moon]);
    return map;
  },
  new Map<PlanetKey, MoonDatum[]>(),
);

export const MOON_BY_KEY: ReadonlyMap<MoonKey, MoonDatum> = new Map(
  MOONS.map((moon) => [moon.key, moon]),
);

export const satellitesOf = (parent: PlanetKey): readonly MoonDatum[] =>
  MOONS_BY_PARENT.get(parent) ?? [];
