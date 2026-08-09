import {
  AdditiveBlending,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  type Material,
} from 'three';

import type { BodyDatum } from '../data/bodies';
import { SUN_RADIUS, spinVelocity } from './scale';
import { createGlowTexture, createSurfaceTexture } from './textures';
import type { SunAssembly } from './types';

/**
 * The Sun.
 *
 * The photosphere is a shader rather than a lit material — the star *is* the
 * light source, so shading it would be backwards. Three things sell it:
 *
 *   · the granulation map is sampled twice at slowly diverging offsets and
 *     mixed, so cells churn instead of sitting still;
 *   · limb darkening, because a real star is dimmer at the edge where you see
 *     through more of its cooler outer plasma;
 *   · output above 1.0, so the bloom pass has something to bloom.
 */

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDirection;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vViewDirection = normalize(-viewPosition.xyz);
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uGranulation;
  uniform float uTime;
  uniform float uIntensity;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDirection;

  void main() {
    // Two samples drifting apart at different rates: the interference between
    // them is what makes the surface boil rather than scroll.
    vec3 slow = texture2D(uGranulation, vUv + vec2(uTime * 0.006, uTime * 0.0021)).rgb;
    vec3 fast = texture2D(uGranulation, vUv * 2.1 - vec2(uTime * 0.011, uTime * 0.004)).rgb;
    vec3 plasma = mix(slow, fast, 0.42);

    // Limb darkening — the classic Eddington approximation, near enough.
    float mu = clamp(dot(normalize(vNormal), normalize(vViewDirection)), 0.0, 1.0);
    float limb = 0.42 + 0.58 * pow(mu, 0.55);

    // Faceward brightening of the hottest cells, so granules read as sources.
    float hotspot = smoothstep(0.55, 0.95, plasma.r) * 0.5;

    gl_FragColor = vec4(plasma * limb * uIntensity + hotspot, 1.0);
  }
`;

export const createSun = (datum: BodyDatum, pickMaterial: Material): SunAssembly => {
  const granulation = createSurfaceTexture(datum.surface);

  const surface = new ShaderMaterial({
    uniforms: {
      uGranulation: { value: granulation },
      uTime: { value: 0 },
      // > 1 on purpose: this is what crosses the bloom threshold.
      uIntensity: { value: 2.1 },
    },
    vertexShader,
    fragmentShader,
  });

  const mesh = new Mesh(new SphereGeometry(SUN_RADIUS, 64, 48), surface);
  mesh.name = 'sun';

  // Corona is deliberately tight. A wide, beautiful corona washes the inner
  // planets out of the frame at the default zoom, which costs more than it
  // gives.
  const halo = new Sprite(
    new SpriteMaterial({
      map: createGlowTexture([
        [0.0, 'rgba(255,246,214,0.80)'],
        [0.3, 'rgba(255,186,88,0.30)'],
        [0.62, 'rgba(255,126,40,0.07)'],
        [1.0, 'rgba(255,110,30,0)'],
      ]),
      blending: AdditiveBlending,
      transparent: true,
      depthWrite: false,
    }),
  );
  halo.scale.setScalar(SUN_RADIUS * 2.5);
  mesh.add(halo);

  const corona = new Sprite(
    new SpriteMaterial({
      map: createGlowTexture([
        [0.0, 'rgba(255,205,135,0.16)'],
        [0.4, 'rgba(255,150,60,0.05)'],
        [1.0, 'rgba(255,120,40,0)'],
      ]),
      blending: AdditiveBlending,
      transparent: true,
      depthWrite: false,
      opacity: 0.75,
    }),
  );
  corona.scale.setScalar(SUN_RADIUS * 5.5);
  mesh.add(corona);

  const pick = new Mesh(new SphereGeometry(SUN_RADIUS * 1.15, 16, 12), pickMaterial);
  pick.name = 'sun:pick';
  mesh.add(pick);

  return {
    body: {
      datum,
      radius: SUN_RADIUS,
      anchor: mesh, // the Sun is its own anchor, parked at the origin
      tiltGroup: null, // never tilted, never hover-scaled (it owns the sprites)
      mesh,
      pick,
      orbitLine: null,
      reticle: null,
      ellipse: null,
      clouds: null,
      atmosphere: null,
      satelliteGroup: null,
      moons: [],
      omega: 0,
      // Visibly slow: the real 25-day rotation would be imperceptible here.
      spin: spinVelocity(datum.rotDays) * 0.12,
      phase: 0,
      hoverScale: 1,
      satelliteReveal: 0,
    },
    halo,
    corona,
    surface,
  };
};
