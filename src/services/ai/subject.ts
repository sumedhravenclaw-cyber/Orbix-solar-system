import { BODY_BY_KEY, type BodyKey, type PlanetKey } from '../../data/bodies';
import { knowledgeFor, type BodyKnowledge } from '../../data/celestialKnowledge';
import { MOON_BY_KEY, satellitesOf } from '../../data/moons';

/**
 * One selected body, flattened.
 *
 * The console addresses planets and moons through the same key space, and the
 * guide should not care which it was handed. This resolves either into a single
 * shape, pulling every number from the existing data files and only the
 * narrative colour from the knowledge layer.
 */
export interface GuideSubject {
  readonly key: BodyKey;
  readonly name: string;
  readonly kind: 'star' | 'planet' | 'moon';
  readonly classification: string;
  readonly tagline: string;
  readonly swatch: string;
  readonly knowledge?: BodyKnowledge;

  /** Equatorial diameter, km. */
  readonly diameterKm: number;
  /** Size relative to Earth, where known (planets and the Sun). */
  readonly earths?: number;
  /** Orbital period in Earth days — about its primary, whatever that is. */
  readonly periodDays: number;
  /** Rotation period in Earth days; negative is retrograde. Absent for moons. */
  readonly rotationDays?: number;
  /** Semi-major axis from the Sun, AU. Absent for moons. */
  readonly au?: number;
  /** Semi-major axis about the parent, km. Moons only. */
  readonly axisKm?: number;
  readonly eccentricity?: number;
  readonly inclination: number;
  readonly axialTilt?: number;
  readonly parentName?: string;
  /** Names of tracked satellites, for planets that have them. */
  readonly satellites: readonly string[];
  /** Total known moons as reported by the catalogue, e.g. "97". */
  readonly knownMoons?: string;
  readonly hasRings: boolean;
  /** The catalogue's own one-line characterisation. */
  readonly blurb: string;
}

export function resolveSubject(key: BodyKey): GuideSubject | null {
  const planet = BODY_BY_KEY.get(key as PlanetKey);
  if (planet) {
    const satellites = satellitesOf(planet.key);
    const knowledge = knowledgeFor(planet.key);
    return {
      key,
      name: planet.name,
      kind: planet.key === 'sun' ? 'star' : 'planet',
      classification: planet.type,
      tagline: knowledge?.tagline ?? planet.type,
      swatch: planet.swatch,
      knowledge,
      diameterKm: planet.diameterKm,
      earths: planet.earths,
      periodDays: planet.periodYr * 365.25,
      rotationDays: planet.rotDays,
      au: planet.au,
      eccentricity: planet.ecc,
      inclination: planet.incl,
      axialTilt: planet.tilt,
      satellites: satellites.map((moon) => moon.name),
      knownMoons: planet.moons,
      hasRings: Boolean(planet.rings),
      blurb: planet.blurb,
    };
  }

  const moon = MOON_BY_KEY.get(key as `${PlanetKey}:${string}`);
  if (!moon) return null;

  const parent = BODY_BY_KEY.get(moon.parent);
  const knowledge = knowledgeFor(moon.key);
  return {
    key,
    name: moon.name,
    kind: 'moon',
    classification: `Natural satellite of ${parent?.name ?? moon.parent}`,
    tagline: knowledge?.tagline ?? `Moon of ${parent?.name ?? moon.parent}`,
    swatch: moon.swatch,
    knowledge,
    diameterKm: moon.radiusKm * 2,
    periodDays: moon.periodDays,
    axisKm: moon.axisKm,
    inclination: moon.incl,
    parentName: parent?.name ?? moon.parent,
    satellites: [],
    hasRings: false,
    blurb: moon.note,
  };
}
