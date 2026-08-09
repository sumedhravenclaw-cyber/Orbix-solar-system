import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Points,
  ShaderMaterial,
} from 'three';

/**
 * GPU-animated starfield.
 *
 * 9,000 points on a large shell. Each star carries its own phase attribute so
 * the twinkle is computed per-vertex on the GPU — the CPU never touches the
 * buffer after upload, which keeps the whole effect off the main thread.
 *
 * A third of the stars are flattened toward a tilted plane to suggest the
 * galactic band.
 */

const STAR_COUNT = 9_000;

/** Rough stellar classes, blue-white → red. */
const TINTS: readonly (readonly [number, number, number])[] = [
  [0.72, 0.82, 1.0],
  [1.0, 1.0, 1.0],
  [1.0, 0.94, 0.82],
  [1.0, 0.8, 0.62],
  [1.0, 0.68, 0.58],
];

const vertexShader = /* glsl */ `
  attribute vec3  aColor;
  attribute float aSize;
  attribute float aPhase;

  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uTwinkle;   // 0 disables scintillation for reduced-motion

  varying vec3  vColor;
  varying float vBrightness;

  void main() {
    vColor = aColor;

    // Two detuned sines → irregular, non-repeating scintillation.
    float flicker = 0.26 * sin(uTime * 1.7 + aPhase * 6.2831)
                  + 0.12 * sin(uTime * 3.9 + aPhase * 17.0);
    float brightness = 0.62 + flicker * uTwinkle;
    vBrightness = brightness;

    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uPixelRatio * brightness * (300.0 / max(1.0, -viewPosition.z));
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3  vColor;
  varying float vBrightness;

  void main() {
    vec2 offset = gl_PointCoord - 0.5;
    float dist = length(offset);
    if (dist > 0.5) discard;               // round point, not a square

    float alpha = smoothstep(0.5, 0.03, dist);
    alpha *= alpha;                         // tighter falloff → crisper core
    gl_FragColor = vec4(vColor * (0.55 + 0.75 * vBrightness), alpha);
  }
`;

export interface Starfield {
  readonly points: Points;
  readonly material: ShaderMaterial;
}

export const createStarfield = (pixelRatio: number, reducedMotion: boolean): Starfield => {
  const positions = new Float32Array(STAR_COUNT * 3);
  const colors = new Float32Array(STAR_COUNT * 3);
  const sizes = new Float32Array(STAR_COUNT);
  const phases = new Float32Array(STAR_COUNT);

  for (let i = 0; i < STAR_COUNT; i += 1) {
    // Uniform direction on a sphere (inverse-transform sampling on cos φ).
    const u = Math.random() * 2 - 1;
    const angle = Math.random() * Math.PI * 2;
    const ring = Math.sqrt(1 - u * u);

    const x = ring * Math.cos(angle);
    let y = u;
    let z = ring * Math.sin(angle);

    if (i % 3 === 0) {
      // Squash toward the equator, then tilt the whole plane.
      y *= 0.14;
      const tilt = 0.42;
      const ty = y * Math.cos(tilt) - z * Math.sin(tilt);
      const tz = y * Math.sin(tilt) + z * Math.cos(tilt);
      y = ty;
      z = tz;
    }

    const distance = 620 + Math.random() * 900;
    positions[i * 3] = x * distance;
    positions[i * 3 + 1] = y * distance;
    positions[i * 3 + 2] = z * distance;

    const tint = TINTS[Math.floor(Math.random() ** 2 * TINTS.length)];
    const brightness = 0.45 + Math.random() * 0.55;
    colors[i * 3] = tint[0] * brightness;
    colors[i * 3 + 1] = tint[1] * brightness;
    colors[i * 3 + 2] = tint[2] * brightness;

    // Steep bias: mostly pinpricks, a handful of standout stars.
    sizes[i] = 1.1 + Math.pow(Math.random(), 7) * 5.5;
    phases[i] = Math.random();
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('aColor', new BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new BufferAttribute(sizes, 1));
  geometry.setAttribute('aPhase', new BufferAttribute(phases, 1));

  const material = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: pixelRatio },
      uTwinkle: { value: reducedMotion ? 0 : 1 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });

  const points = new Points(geometry, material);
  points.frustumCulled = false; // the shell always surrounds the camera
  points.name = 'starfield';

  return { points, material };
};
