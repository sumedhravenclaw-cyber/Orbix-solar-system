import {
  CanvasTexture,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
} from 'three';

import type { SurfaceSpec } from '../data/bodies';
import { cylindricalSample, fbm, hexToRgb, hash2, sampleRamp, valueNoise } from './noise';

/**
 * Procedural texture factory.
 *
 * Every surface in the app is painted into an offscreen <canvas> and uploaded
 * as a CanvasTexture — no image files, no network requests, no loader states.
 *
 * Textures are the largest consumer of GPU VRAM in a Three.js scene and are
 * NOT garbage collected, so each factory returns a texture the engine registers
 * for explicit disposal.
 */

const SURFACE_WIDTH = 512;
const SURFACE_HEIGHT = 256;

const createCanvas = (width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

const finalise = (canvas: HTMLCanvasElement, wrap: boolean): CanvasTexture => {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  if (wrap) texture.wrapS = RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
};

/** Per-pixel intensity for one surface kind, before the colour ramp. */
const surfaceIntensity = (
  spec: SurfaceSpec,
  cx: number,
  cy: number,
  v: number,
): number => {
  switch (spec.kind) {
    case 'gas': {
      // Latitude belts warped by turbulence → convective bands and zones.
      const turbulence = (fbm(cx * 1.6, cy * 1.6, 4) - 0.5) * (spec.swirl ?? 1) * 0.16;
      const band = 0.5 + 0.5 * Math.sin((v + turbulence) * Math.PI * 2 * (spec.bands ?? 6));
      return band * 0.72 + fbm(cx * 3.2, cy * 3.2, 3) * 0.28;
    }
    case 'star': {
      // Granulation cells over a bright base.
      return (
        0.42 + (fbm(cx * 5.5, cy * 5.5, 4) - 0.5) * 1.5 + (fbm(cx * 14, cy * 14, 2) - 0.5) * 0.6
      );
    }
    case 'earth': {
      // Threshold the height field into ocean vs. land, then tint the land.
      const height = fbm(cx * 1.9, cy * 1.9, 5);
      if (height < 0.47) return 0.05 + height * 0.55;
      const vegetation = fbm(cx * 6 + 40, cy * 6 + 40, 3);
      return 0.58 + (vegetation > 0.5 ? 0.12 : 0.34) + (height - 0.47) * 0.4;
    }
    case 'rocky':
    default:
      return fbm(cx * 2.2, cy * 2.2, 5) * 0.8 + fbm(cx * 9, cy * 9, 2) * 0.2;
  }
};

/** Stamp weathered impact craters over the noise field. */
const drawCraters = (ctx: CanvasRenderingContext2D, count: number): void => {
  for (let i = 0; i < count; i += 1) {
    const cx = Math.random() * SURFACE_WIDTH;
    const cy = SURFACE_HEIGHT * 0.5 + (Math.random() - 0.5) * SURFACE_HEIGHT * 0.92;
    // Biased small: a few large basins, many little pockmarks.
    const radius = 1.6 + Math.pow(Math.random(), 2.6) * 15;

    const gradient = ctx.createRadialGradient(cx, cy, radius * 0.15, cx, cy, radius);
    gradient.addColorStop(0, 'rgba(255,255,255,0.10)'); // raised rim catching light
    gradient.addColorStop(0.55, 'rgba(0,0,0,0.30)'); // shadowed floor
    gradient.addColorStop(1, 'rgba(255,255,255,0.06)'); // ejecta blanket

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
  }
};

/** A long-lived anticyclone (Jupiter's Red Spot, Neptune's Dark Spot). */
const drawSpot = (ctx: CanvasRenderingContext2D, tone: 'light' | 'dark'): void => {
  const cx = SURFACE_WIDTH * 0.68;
  const cy = SURFACE_HEIGHT * 0.62;
  const rx = SURFACE_WIDTH * 0.1;
  const ry = SURFACE_HEIGHT * 0.075;

  const gradient = ctx.createRadialGradient(cx, cy, 1, cx, cy, rx);
  if (tone === 'dark') {
    gradient.addColorStop(0, 'rgba(9,18,60,0.95)');
    gradient.addColorStop(1, 'rgba(20,40,110,0)');
  } else {
    gradient.addColorStop(0, 'rgba(196,74,38,0.95)');
    gradient.addColorStop(1, 'rgba(196,110,60,0)');
  }

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx); // squash the circle into the belt
  ctx.translate(-cx, -cy);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

/** A thin, broken cloud veil for Earth. */
const drawClouds = (ctx: CanvasRenderingContext2D): void => {
  ctx.globalAlpha = 0.3;
  for (let i = 0; i < 190; i += 1) {
    const cx = Math.random() * SURFACE_WIDTH;
    const cy = SURFACE_HEIGHT * 0.5 + (Math.random() - 0.5) * SURFACE_HEIGHT * 0.85;
    const radius = 5 + Math.random() * 24;

    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    gradient.addColorStop(0, 'rgba(255,255,255,0.55)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * (0.5 + Math.random()), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
};

/** Paint a full planetary/stellar surface map. */
export const createSurfaceTexture = (spec: SurfaceSpec): CanvasTexture => {
  const canvas = createCanvas(SURFACE_WIDTH, SURFACE_HEIGHT);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable — cannot paint surfaces.');

  const image = ctx.createImageData(SURFACE_WIDTH, SURFACE_HEIGHT);
  const pixels = image.data;

  const ramp = spec.palette.map(hexToRgb);
  // Seed from the palette so each body gets a distinct — but stable — field.
  const seed = hash2(spec.palette.length * 7.3, ramp[0][0]) * 100;

  for (let y = 0; y < SURFACE_HEIGHT; y += 1) {
    const v = y / SURFACE_HEIGHT;
    const latitude = (v - 0.5) * 2; // −1 (north) … +1 (south)

    for (let x = 0; x < SURFACE_WIDTH; x += 1) {
      const [cx, cy] = cylindricalSample(x / SURFACE_WIDTH, v, 2.4, seed);
      let [r, g, b] = sampleRamp(ramp, surfaceIntensity(spec, cx, cy, v));

      // Polar ice, feathered by latitude and broken up by noise.
      if (spec.caps) {
        const capEdge = 1 - spec.caps * 2;
        const k = (Math.abs(latitude) - capEdge) / Math.max(0.001, 1 - capEdge);
        if (k > 0) {
          const mix = Math.min(1, k * 1.6) * (0.55 + fbm(cx * 8, cy * 8, 2) * 0.45);
          r += (244 - r) * mix;
          g += (248 - g) * mix;
          b += (255 - b) * mix;
        }
      }

      // Slight darkening toward the poles reads as sphericity even unlit.
      const poleShade = 1 - Math.pow(Math.abs(latitude), 3) * 0.18;
      const offset = (y * SURFACE_WIDTH + x) * 4;
      pixels[offset] = r * poleShade;
      pixels[offset + 1] = g * poleShade;
      pixels[offset + 2] = b * poleShade;
      pixels[offset + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);

  if (spec.craters) drawCraters(ctx, spec.craters);
  if (spec.spot) drawSpot(ctx, spec.spot);
  if (spec.kind === 'earth') drawClouds(ctx);

  return finalise(canvas, true);
};

/** Radial gradient sprite sheet used for the Sun's halo and corona. */
export const createGlowTexture = (stops: readonly (readonly [number, string])[]): CanvasTexture => {
  const size = 256;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable — cannot paint the corona.');

  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [offset, color] of stops) gradient.addColorStop(offset, color);

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  return finalise(canvas, false);
};

/** Banded, edge-feathered strip mapped radially across a ring plane. */
export const createRingTexture = (faint = false): CanvasTexture => {
  const width = 512;
  const height = 8;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable — cannot paint rings.');

  for (let x = 0; x < width; x += 1) {
    const t = x / width;

    // Two detuned sine bands plus noise → irregular ringlets.
    let alpha =
      0.55 +
      0.28 * Math.sin(t * 46) +
      0.18 * Math.sin(t * 133 + 1.1) +
      (valueNoise(t * 90, 3.7) - 0.5) * 0.4;

    if (t > 0.6 && t < 0.665) alpha *= 0.12; // Cassini-style division
    alpha *= Math.min(1, t * 7) * Math.min(1, (1 - t) * 6); // feather both edges
    alpha = Math.max(0, Math.min(1, alpha)) * (faint ? 0.32 : 1);

    const luminance = 168 + 70 * alpha;
    ctx.fillStyle = `rgba(${luminance | 0}, ${(luminance * 0.94) | 0}, ${(luminance * 0.8) | 0}, ${alpha.toFixed(3)})`;
    ctx.fillRect(x, 0, 1, height);
  }

  return finalise(canvas, false);
};

/** Convenience guard so callers can dispose a possibly-undefined texture. */
export const disposeTexture = (texture: Texture | null | undefined): void => {
  texture?.dispose();
};
