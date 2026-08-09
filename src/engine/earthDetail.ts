import {
  CanvasTexture,
  Color,
  Mesh,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  SphereGeometry,
} from 'three';

import { cylindricalSample, fbm } from './noise';
import { patchShader, softenTerminator } from './shading';

/**
 * Earth-specific detail: a separate cloud deck and night-side city lights.
 *
 * Both are the difference between "blue marble texture" and "planet".
 */

/* ==========================================================================
   Cloud deck
   ========================================================================== */

/**
 * Clouds live on their own slightly larger sphere rather than being baked into
 * the surface map. That buys two things a baked cloud layer cannot: the deck
 * rotates at its own rate (so weather drifts over the ground), and it casts a
 * genuine silhouette against the limb.
 */
const createCloudTexture = (): CanvasTexture => {
  const width = 512;
  const height = 256;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable — cannot paint clouds.');

  const image = ctx.createImageData(width, height);
  const pixels = image.data;

  for (let y = 0; y < height; y += 1) {
    const v = y / height;
    const latitude = (v - 0.5) * 2;

    // Real cloud cover is banded: heavy at the equator (ITCZ) and at the polar
    // fronts, thin over the subtropical highs. A flat noise field looks wrong.
    const banding =
      0.55 +
      0.45 * Math.cos(latitude * Math.PI * 3.1) * 0.5 +
      0.3 * (1 - Math.abs(latitude));

    for (let x = 0; x < width; x += 1) {
      const [cx, cy] = cylindricalSample(x / width, v, 3.1, 11.7);
      const density = fbm(cx * 1.7, cy * 1.7, 5);

      // Sharp threshold, soft edges → discrete cloud masses, not grey haze.
      const coverage = Math.max(0, density * banding - 0.34) * 2.6;
      const alpha = Math.min(1, coverage) * 255;

      const offset = (y * width + x) * 4;
      pixels[offset] = 255;
      pixels[offset + 1] = 255;
      pixels[offset + 2] = 255;
      pixels[offset + 3] = alpha;
    }
  }

  ctx.putImageData(image, 0, 0);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
};

export const createCloudLayer = (planetRadius: number): Mesh => {
  // Standard rather than Lambert: the deck has to sit in the same lighting
  // model as the ground beneath it. Lambert ignores scene.environment, so the
  // clouds stayed lit by direct sun alone and read as a flat decal against a
  // surface that was picking up ambient sky.
  const material = new MeshStandardMaterial({
    map: createCloudTexture(),
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
    roughness: 0.95,
    metalness: 0,
    envMapIntensity: 0.6,
  });

  // Match the ground's soft terminator, or the deck's day/night edge cuts
  // across the planet's at a visibly different angle.
  softenTerminator(material, 0.16);

  const mesh = new Mesh(new SphereGeometry(planetRadius * 1.015, 96, 64), material);
  mesh.name = 'clouds';
  return mesh;
};

/* ==========================================================================
   Night-side city lights
   ========================================================================== */

/**
 * City lights, keyed to the land mask so they never appear mid-ocean, and
 * clustered rather than evenly scattered.
 */
const createNightTexture = (): CanvasTexture => {
  const width = 512;
  const height = 256;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable — cannot paint night lights.');

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'lighter';

  for (let i = 0; i < 5200; i += 1) {
    const u = Math.random();
    const v = 0.5 + (Math.random() - 0.5) * 0.82; // no lights at the poles

    // Reuse the surface height field: > 0.47 is land in textures.ts.
    const [cx, cy] = cylindricalSample(u, v, 2.4, 12.86);
    if (fbm(cx * 1.9, cy * 1.9, 5) < 0.5) continue;

    // Population thins with latitude and clusters along a few longitudes.
    const density = Math.pow(1 - Math.abs(v - 0.5) * 2, 0.6);
    if (Math.random() > density) continue;

    const x = u * width;
    const y = v * height;
    const radius = 0.6 + Math.random() * 2.2;

    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, 'rgba(255, 214, 150, 0.85)');
    glow.addColorStop(1, 'rgba(255, 170, 70, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  return texture;
};

/**
 * Patch a planet material so its emissive map only shows on the *unlit* side.
 *
 * `emissiveMap` alone glows through daylight, which looks like a bug. There is
 * no material flag for "emit only in shadow", so the shader is edited in place:
 * the emissive term is multiplied by how much the fragment faces away from the
 * light. Using onBeforeCompile keeps every other feature of MeshStandardMaterial
 * — shadows, tone mapping, fog — intact, which a bespoke ShaderMaterial would
 * throw away.
 *
 * Installed through `patchShader` so it composes with the terminator softening
 * rather than overwriting it.
 */
export const applyNightLights = (material: MeshStandardMaterial): void => {
  material.emissiveMap = createNightTexture();
  material.emissive = new Color(0xffffff);
  material.emissiveIntensity = 1.6;

  patchShader(material, (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      /* glsl */ `
        #include <emissivemap_fragment>

        // pointLights[0] is the Sun; the scene has exactly one point light.
        #if NUM_POINT_LIGHTS > 0
          vec3 toLight = normalize(pointLights[0].position - vViewPosition * -1.0);
          float facing = dot(normalize(vNormal), toLight);
          // Fully on well past the terminator, fully off in daylight.
          totalEmissiveRadiance *= smoothstep(0.12, -0.28, facing);
        #endif
      `,
    );
  });
};
