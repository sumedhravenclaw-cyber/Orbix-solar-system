import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  Line,
  LineBasicMaterial,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  RingGeometry,
  SphereGeometry,
  Vector3,
  type Material,
} from 'three';

import type { BodyDatum } from '../data/bodies';
import { createAtmosphere } from './atmosphere';
import { createMoonSystem, type MoonMaterials } from './createMoons';
import { applyNightLights, createCloudLayer } from './earthDetail';
import { angularVelocity, bodyRadius, ellipseFor, ellipsePoint, spinVelocity } from './scale';
import { createRingTexture, createSurfaceTexture } from './textures';
import type { SceneBody } from './types';

/**
 * Builds one planet, returning both the scene subtree and the metadata the
 * render loop needs.
 *
 * Hierarchy:
 *   orbitGroup              inclination + ascending node
 *     ├── orbitLine         sampled from the same ellipse the planet follows
 *     └── anchor            rides the ellipse
 *           ├── tiltGroup   axial tilt
 *           │     ├── mesh  the surface (spins)
 *           │     ├── clouds     Earth only, spins faster
 *           │     ├── rings      Saturn / Uranus
 *           │     └── atmosphere limb shell (untilted visually, but follows)
 *           ├── satellites  moon systems, hidden until focused
 *           ├── pick        invisible oversized hit target
 *           └── reticle     selection ring, billboarded by the render loop
 */

const ORBIT_SEGMENTS = 512;
const RING_SEGMENTS = 160;

export interface PlanetBuild {
  readonly orbitGroup: Group;
  readonly body: SceneBody;
}

/** Sample the orbit path so the drawn line and the motion cannot disagree. */
const buildOrbitLine = (datum: BodyDatum, ellipse: ReturnType<typeof ellipseFor>): Line => {
  const positions = new Float32Array((ORBIT_SEGMENTS + 1) * 3);

  for (let i = 0; i <= ORBIT_SEGMENTS; i += 1) {
    const { x, z } = ellipsePoint(ellipse, (i / ORBIT_SEGMENTS) * Math.PI * 2);
    positions[i * 3] = x;
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = z;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));

  const material = new LineBasicMaterial({
    // Desaturated toward the background so eight orbit lines never shout.
    color: new Color(datum.swatch).lerp(new Color(0x0a1018), 0.55),
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
  });

  const line = new Line(geometry, material);
  line.name = `${datum.key}:orbit`;
  return line;
};

/**
 * RingGeometry's default UVs are planar, which smears a radial texture. Remap
 * so `u` runs from the inner to the outer edge.
 */
const buildRingPlane = (datum: BodyDatum, planetRadius: number): Mesh | null => {
  if (!datum.rings) return null;

  const inner = planetRadius * datum.rings.inner;
  const outer = planetRadius * datum.rings.outer;
  const geometry = new RingGeometry(inner, outer, RING_SEGMENTS, 1);

  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  const vertex = new Vector3();

  for (let i = 0; i < position.count; i += 1) {
    vertex.fromBufferAttribute(position, i);
    uv.setXY(i, (vertex.length() - inner) / (outer - inner), i % 2);
  }

  const mesh = new Mesh(
    geometry,
    new MeshStandardMaterial({
      map: createRingTexture(datum.rings.faint),
      side: DoubleSide,
      transparent: true,
      opacity: datum.rings.faint ? 0.55 : 0.95,
      roughness: 1,
      metalness: 0,
      depthWrite: false,
    }),
  );
  mesh.rotation.x = -Math.PI / 2; // lie in the planet's equatorial plane
  mesh.name = `${datum.key}:rings`;
  return mesh;
};

export const createPlanet = (
  datum: BodyDatum,
  index: number,
  pickMaterial: Material,
  moonMaterials: MoonMaterials,
): PlanetBuild => {
  const radius = bodyRadius(datum.earths);
  const ellipse = ellipseFor(datum.au, datum.ecc);

  // Real inclination, plus a fixed pseudo-random ascending node so the
  // perihelia of all eight orbits are not artificially aligned.
  const orbitGroup = new Group();
  orbitGroup.name = `${datum.key}:plane`;
  orbitGroup.rotation.y = index * 0.79;
  orbitGroup.rotation.x = MathUtils.degToRad(datum.incl);

  const orbitLine = buildOrbitLine(datum, ellipse);
  orbitGroup.add(orbitLine);

  const anchor = new Object3D();
  anchor.name = `${datum.key}:anchor`;
  orbitGroup.add(anchor);

  const tiltGroup = new Group();
  tiltGroup.rotation.z = MathUtils.degToRad(datum.tilt);
  anchor.add(tiltGroup);

  const surface = createSurfaceTexture(datum.surface);
  const isRocky = datum.surface.kind === 'rocky' || datum.surface.kind === 'earth';

  const material = new MeshStandardMaterial({
    map: surface,
    roughness: isRocky ? 0.92 : 0.72,
    metalness: 0,
    // Reusing the colour map as a bump map is free and gives rocky worlds
    // believable micro-relief along the terminator.
    bumpMap: isRocky ? surface : null,
    bumpScale: isRocky ? 0.012 : 0,
  });

  if (datum.key === 'earth') {
    applyNightLights(material);
  } else {
    // A trace of self-illumination so night sides read as shadow, not holes.
    material.emissive = new Color(datum.swatch);
    material.emissiveIntensity = 0.03;
  }

  const mesh = new Mesh(new SphereGeometry(radius, 64, 48), material);
  mesh.name = datum.key;
  tiltGroup.add(mesh);

  const clouds = datum.key === 'earth' ? createCloudLayer(radius) : null;
  if (clouds) tiltGroup.add(clouds);

  const rings = buildRingPlane(datum, radius);
  if (rings) tiltGroup.add(rings);

  // Gas giants have deep, hazy limbs; terrestrial atmospheres are a thin line.
  const isGiant = datum.earths > 3;
  const shell = datum.atmosphere
    ? createAtmosphere(radius, datum.atmosphere, {
        thickness: isGiant ? 0.035 : 0.06,
        intensity: isGiant ? 0.75 : 1.05,
        power: isGiant ? 3.0 : 2.2,
      })
    : null;
  if (shell) tiltGroup.add(shell.mesh);

  const satellites = createMoonSystem(datum, radius, moonMaterials, pickMaterial);
  if (satellites) anchor.add(satellites.group);

  // Small planets would be near-impossible to hit at default zoom, so the
  // raycast target is a generously sized invisible sphere. `pickMaterial` is a
  // single shared instance across every body — identical properties, one GPU
  // material. A Mesh whose material has visible:false still raycasts.
  const pick = new Mesh(new SphereGeometry(Math.max(radius * 1.9, 1.5), 16, 12), pickMaterial);
  pick.name = `${datum.key}:pick`;
  anchor.add(pick);

  const reticle = new Mesh(
    new RingGeometry(radius * 1.55, radius * 1.62, 96),
    new MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.9,
      side: DoubleSide,
      depthWrite: false,
    }),
  );
  reticle.visible = false;
  reticle.name = `${datum.key}:reticle`;
  anchor.add(reticle);

  const body: SceneBody = {
    datum,
    radius,
    anchor,
    tiltGroup,
    mesh,
    pick,
    orbitLine,
    reticle,
    ellipse,
    clouds,
    atmosphere: shell?.material ?? null,
    satelliteGroup: satellites?.group ?? null,
    moons: satellites?.moons ?? [],
    // ω = 2π / period. Period ratios are exact, so relative speeds are correct.
    omega: angularVelocity(datum.periodYr),
    spin: spinVelocity(datum.rotDays),
    phase: hashPhase(datum.key),
    hoverScale: 1,
    satelliteReveal: 0,
  };

  // Place it before the first frame so nothing pops in at the origin.
  positionOnOrbit(body, 0);

  return { orbitGroup, body };
};

/** Move a body to where it belongs at `simulatedSeconds`. */
export const positionOnOrbit = (body: SceneBody, simulatedSeconds: number): void => {
  if (!body.ellipse) return;
  const { x, z } = ellipsePoint(body.ellipse, body.phase + simulatedSeconds * body.omega);
  body.anchor.position.set(x, 0, z);
};

/**
 * Stable per-body starting phase.
 *
 * Math.random() would scatter the planets differently on every reload, which
 * makes screenshots and bug reports non-reproducible.
 */
function hashPhase(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) % 100_000;
  return (hash / 100_000) * Math.PI * 2;
}
