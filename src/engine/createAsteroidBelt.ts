import {
  Color,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  MathUtils,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three';

import { orbitRadius } from './scale';

/**
 * The main asteroid belt, 2.1 – 3.3 AU.
 *
 * Drawn as three `InstancedMesh` shells — one geometry, one material, three
 * draw calls for 2,400 rocks. Individually orbiting each asteroid would mean
 * recomposing 2,400 matrices every frame; instead each shell is a rigid group
 * rotating at the mean rate for its radius. Inner shells therefore lap outer
 * ones exactly as Kepler requires, and the per-frame cost is three rotations.
 *
 * The gap around 2.5 AU is the Kirkwood 3:1 resonance with Jupiter, which is
 * genuinely swept clear — a uniform ring would be the less realistic choice.
 */

const SHELL_COUNT = 3;
const ROCKS_PER_SHELL = 800;

/** Inner and outer edge of the belt, in AU. */
const BELT_INNER_AU = 2.1;
const BELT_OUTER_AU = 3.3;

/** Kirkwood gaps (AU) and how wide to clear around each. */
const KIRKWOOD_GAPS: readonly (readonly [number, number])[] = [
  [2.5, 0.06],
  [2.82, 0.04],
  [2.95, 0.03],
];

const inGap = (au: number): boolean =>
  KIRKWOOD_GAPS.some(([centre, halfWidth]) => Math.abs(au - centre) < halfWidth);

export interface AsteroidBelt {
  readonly group: Group;
  /** Called each frame with the simulated delta, in seconds. */
  update(simulatedDelta: number): void;
}

export const createAsteroidBelt = (): AsteroidBelt => {
  const group = new Group();
  group.name = 'asteroid-belt';

  // One low-poly rock, reused 2,400 times. detail:0 keeps it at 20 triangles.
  const geometry = new IcosahedronGeometry(1, 0);
  const material = new MeshStandardMaterial({
    color: new Color(0x8a8073),
    roughness: 1,
    metalness: 0,
    flatShading: true, // faceted rubble reads better than smooth pebbles
  });

  const shells: { mesh: InstancedMesh; rate: number }[] = [];

  const matrix = new Matrix4();
  const position = new Vector3();
  const quaternion = new Quaternion();
  const scale = new Vector3();
  const axis = new Vector3();

  for (let shellIndex = 0; shellIndex < SHELL_COUNT; shellIndex += 1) {
    const mesh = new InstancedMesh(geometry, material, ROCKS_PER_SHELL);
    mesh.name = `belt-shell-${shellIndex}`;
    mesh.frustumCulled = false;

    // Each shell owns a slice of the belt's radial range.
    const innerAu = MathUtils.lerp(BELT_INNER_AU, BELT_OUTER_AU, shellIndex / SHELL_COUNT);
    const outerAu = MathUtils.lerp(
      BELT_INNER_AU,
      BELT_OUTER_AU,
      (shellIndex + 1) / SHELL_COUNT,
    );

    let placed = 0;
    let attempts = 0;
    while (placed < ROCKS_PER_SHELL && attempts < ROCKS_PER_SHELL * 8) {
      attempts += 1;
      const au = MathUtils.lerp(innerAu, outerAu, Math.random());
      if (inGap(au)) continue;

      const radius = orbitRadius(au);
      const theta = Math.random() * Math.PI * 2;

      // Real belt inclinations reach ~20°, so it is a torus, not a disc.
      const inclination = (Math.random() - 0.5) * 0.34;
      const height = Math.sin(inclination) * radius * 0.11;

      position.set(Math.cos(theta) * radius, height, Math.sin(theta) * radius);

      axis
        .set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
        .normalize();
      quaternion.setFromAxisAngle(axis, Math.random() * Math.PI * 2);

      // Heavily biased small: a few Ceres-alikes, mostly gravel.
      const size = 0.012 + Math.pow(Math.random(), 3.4) * 0.075;
      scale.setScalar(size);

      mesh.setMatrixAt(placed, matrix.compose(position, quaternion, scale));
      placed += 1;
    }

    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);

    // Mean orbital rate for this shell, from Kepler's third law: T ∝ a^1.5.
    const meanAu = (innerAu + outerAu) / 2;
    const periodYears = Math.pow(meanAu, 1.5);
    shells.push({ mesh, rate: (Math.PI * 2) / (periodYears * 10) });
  }

  return {
    group,
    update(simulatedDelta: number) {
      for (const shell of shells) shell.mesh.rotation.y += shell.rate * simulatedDelta;
    },
  };
};
