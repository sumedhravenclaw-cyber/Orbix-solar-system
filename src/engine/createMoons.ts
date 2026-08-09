import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Line,
  LineBasicMaterial,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  type Material,
} from 'three';

import type { BodyDatum, MoonDatum, MoonKind } from '../data/bodies';
import { satellitesOf } from '../data/moons';
import { moonAngularVelocity, moonOrbitRadius, moonRadius } from './scale';
import { createSurfaceTexture } from './textures';
import type { SceneMoon } from './types';

/**
 * Natural satellites.
 *
 * Each moon hangs off its planet's anchor, so it inherits the planet's motion
 * around the Sun for free and only has to solve its own local circle.
 *
 * Moon orbits are drawn as true circles rather than ellipses: at this
 * compression the real eccentricities (Moon 0.055, Titan 0.029) are well under
 * a pixel, so an ellipse would cost geometry for nothing.
 */

const ORBIT_SEGMENTS = 128;

/**
 * Three surface archetypes shared across fifteen moons.
 *
 * Painting fifteen 512×256 maps would double the app's start-up cost for
 * bodies that are a handful of pixels across most of the time.
 */
const MOON_SURFACES: Record<MoonKind, { palette: string[]; craters: number }> = {
  rock: { palette: ['#3a3733', '#5d574f', '#8b8378', '#b3a99b'], craters: 150 },
  ice: { palette: ['#7e8c96', '#aebcc6', '#d6e2e9', '#f2f7fa'], craters: 90 },
  sulphur: { palette: ['#6b4a16', '#a8801f', '#d9b64a', '#f0dc94'], craters: 40 },
};

export interface MoonMaterials {
  readonly byKind: ReadonlyMap<MoonKind, MeshStandardMaterial>;
  dispose(): void;
}

/** Build the three shared moon materials once, up front. */
export const createMoonMaterials = (): MoonMaterials => {
  const byKind = new Map<MoonKind, MeshStandardMaterial>();

  for (const kind of Object.keys(MOON_SURFACES) as MoonKind[]) {
    const spec = MOON_SURFACES[kind];
    const texture = createSurfaceTexture({
      kind: 'rocky',
      palette: spec.palette,
      craters: spec.craters,
    });

    byKind.set(
      kind,
      new MeshStandardMaterial({
        map: texture,
        bumpMap: texture,
        bumpScale: 0.01,
        roughness: 0.95,
        metalness: 0,
      }),
    );
  }

  return {
    byKind,
    dispose() {
      for (const material of byKind.values()) {
        material.map?.dispose();
        material.dispose();
      }
    },
  };
};

export interface MoonSystem {
  /** Parent of everything below; toggled as one unit by the LOD rule. */
  readonly group: Group;
  readonly moons: SceneMoon[];
}

export const createMoonSystem = (
  planet: BodyDatum,
  planetRadius: number,
  materials: MoonMaterials,
  pickMaterial: Material,
): MoonSystem | null => {
  const satellites = satellitesOf(planet.key);
  if (satellites.length === 0) return null;

  const group = new Group();
  group.name = `${planet.key}:satellites`;
  group.visible = false; // revealed by the engine's LOD rule

  const ringOuter = planet.rings ? planet.rings.outer : 0;
  const moons: SceneMoon[] = [];

  for (const datum of satellites) {
    moons.push(buildMoon(datum, planet, planetRadius, ringOuter, materials, pickMaterial, group));
  }

  return { group, moons };
};

function buildMoon(
  datum: MoonDatum,
  planet: BodyDatum,
  planetRadius: number,
  ringOuter: number,
  materials: MoonMaterials,
  pickMaterial: Material,
  parent: Group,
): SceneMoon {
  const radius = moonRadius(datum.radiusKm, planet.diameterKm / 2, planetRadius);
  const orbit = moonOrbitRadius(datum.axisKm, planet.diameterKm, planetRadius, ringOuter);

  // The moon's orbital plane: its real inclination to the parent's equator.
  // Triton's 157° is what makes its retrograde orbit visibly tilted over.
  const plane = new Group();
  plane.rotation.x = MathUtils.degToRad(datum.incl);
  plane.rotation.y = hashAngle(datum.key);
  parent.add(plane);

  // Orbit trace.
  const positions = new Float32Array((ORBIT_SEGMENTS + 1) * 3);
  for (let i = 0; i <= ORBIT_SEGMENTS; i += 1) {
    const theta = (i / ORBIT_SEGMENTS) * Math.PI * 2;
    positions[i * 3] = Math.cos(theta) * orbit;
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = Math.sin(theta) * orbit;
  }
  const orbitGeometry = new BufferGeometry();
  orbitGeometry.setAttribute('position', new BufferAttribute(positions, 3));

  const orbitLine = new Line(
    orbitGeometry,
    new LineBasicMaterial({
      color: new Color(datum.swatch).lerp(new Color(0x0a1018), 0.45),
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    }),
  );
  orbitLine.name = `${datum.key}:orbit`;
  plane.add(orbitLine);

  const anchor = new Object3D();
  anchor.name = `${datum.key}:anchor`;
  plane.add(anchor);

  const material = materials.byKind.get(datum.kind);
  if (!material) throw new Error(`No shared material for moon kind "${datum.kind}".`);

  const mesh = new Mesh(new SphereGeometry(radius, 24, 16), material);
  mesh.name = datum.key;
  anchor.add(mesh);

  // Generous hit target: most moons are two or three pixels across.
  const pick = new Mesh(new SphereGeometry(Math.max(radius * 3, 0.28), 12, 8), pickMaterial);
  pick.name = `${datum.key}:pick`;
  anchor.add(pick);

  return {
    datum,
    radius,
    orbitRadius: orbit,
    anchor,
    mesh,
    pick,
    orbitLine,
    omega: moonAngularVelocity(datum.periodDays),
    phase: hashAngle(`${datum.key}#phase`),
  };
}

/** Stable pseudo-random angle so a reload reproduces the same configuration. */
function hashAngle(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 100_000;
  return (hash / 100_000) * Math.PI * 2;
}

/** Advance every moon in a system to `simulatedSeconds`. */
export const positionMoons = (moons: readonly SceneMoon[], simulatedSeconds: number): void => {
  for (const moon of moons) {
    const theta = moon.phase + simulatedSeconds * moon.omega;
    moon.anchor.position.set(
      Math.cos(theta) * moon.orbitRadius,
      0,
      Math.sin(theta) * moon.orbitRadius,
    );
    // Tidal lock: the same face always points at the parent, which is true of
    // every major moon here.
    moon.mesh.rotation.y = -theta;
  }
};
