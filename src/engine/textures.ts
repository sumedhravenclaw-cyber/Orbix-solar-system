import {
  CanvasTexture,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  type ColorSpace,
  type Texture,
} from 'three';

import type { SurfaceSpec } from '../data/bodies';
import { isLowPowerDevice } from './capability';
import { fbm, hexToRgb, hash2, valueNoise } from './noise';

/**
 * Procedural texture factory.
 *
 * Every surface in the app is painted into an offscreen <canvas> and uploaded
 * as a CanvasTexture — no image files, no network requests, no loader states.
 *
 * Textures are the largest consumer of GPU VRAM in a Three.js scene and are
 * NOT garbage collected, so each factory returns a texture the engine registers
 * for explicit disposal.
 *
 * Planets take the PBR path (`createSurfaceMaps`): one elevation field is
 * evaluated once and albedo, normal, roughness and occlusion are all derived
 * from it. The noise is the expensive part, so deriving four maps from a single
 * pass costs barely more than painting the colour map alone.
 */

const SURFACE_WIDTH = 512;
const SURFACE_HEIGHT = 256;

/**
 * Planet map resolution — the one knob trading boot time for surface detail.
 *
 * Cost is linear in texel count and start-up is dominated by it. Measured on
 * this scene, per body: 512×256 costs ~100ms of noise plus ~55ms of derived
 * maps; 1024×512 costs ~400ms plus ~210ms. Eleven bodies are painted, so the
 * full-fat option is a seven-second boot — too long to justify against 768,
 * which still carries 2.25× the texels of the original and resolves crater
 * rims and coastlines that 512 smeared away.
 *
 * Low-core and touch devices drop to the legacy size: they pay roughly triple
 * per texel, and their screens cannot resolve the difference anyway.
 */
const PBR_WIDTH = isLowPowerDevice() ? 512 : 768;

const createCanvas = (width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

const finalise = (
  canvas: HTMLCanvasElement,
  wrap: boolean,
  colorSpace: ColorSpace = SRGBColorSpace,
): CanvasTexture => {
  const texture = new CanvasTexture(canvas);
  // Only albedo carries colour. Normal/roughness/occlusion are raw numbers and
  // must skip the sRGB decode or every one of them is silently wrong.
  texture.colorSpace = colorSpace;
  if (wrap) texture.wrapS = RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
};

/** Deterministic LCG, so a planet's craters are identical on every reload. */
const makeRng = (seed: number): (() => number) => {
  let state = (seed >>> 0) || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
};

/* ==========================================================================
   Shared field definitions
   ========================================================================== */

/**
 * One pixel's worth of surface, from a single evaluation of the noise field.
 *
 * Colour, elevation and roughness are three questions about the same terrain,
 * and the noise is by far the most expensive part of answering any of them —
 * a 5-octave fbm is twenty Math.sin calls. Evaluating the field once and
 * emitting all three answers is what keeps the PBR upgrade close to the cost of
 * painting the colour map alone.
 *
 * `intensity` reproduces the original colour field exactly, term for term.
 * `relief` is deliberately *not* the same curve: Earth's colour steps hard at
 * the shoreline, and if elevation stepped with it every coast would become a
 * cliff in the normal map. Ocean is returned dead flat instead, which is also
 * what lets the roughness map drop there and read as water.
 */
interface SurfaceSample {
  intensity: number;
  relief: number;
  /** High-frequency term, reused for roughness breakup — never fresh noise. */
  detail: number;
}

const sampleSurface = (
  spec: SurfaceSpec,
  cx: number,
  cy: number,
  v: number,
  out: SurfaceSample,
): void => {
  switch (spec.kind) {
    case 'gas': {
      // Latitude belts warped by turbulence → convective bands and zones.
      const turbulence = (fbm(cx * 1.6, cy * 1.6, 4) - 0.5) * (spec.swirl ?? 1) * 0.16;
      const band = 0.5 + 0.5 * Math.sin((v + turbulence) * Math.PI * 2 * (spec.bands ?? 6));
      const fine = fbm(cx * 3.2, cy * 3.2, 3);
      out.intensity = band * 0.72 + fine * 0.28;
      // Cloud tops: broad soft swells, no hard edges.
      out.relief = band * 0.35 + fine * 0.65;
      out.detail = fine;
      return;
    }
    case 'star': {
      // Granulation cells over a bright base.
      const cells = fbm(cx * 5.5, cy * 5.5, 4);
      const grain = fbm(cx * 14, cy * 14, 2);
      out.intensity = 0.42 + (cells - 0.5) * 1.5 + (grain - 0.5) * 0.6;
      out.relief = cells;
      out.detail = grain;
      return;
    }
    case 'earth': {
      // Threshold the height field into ocean vs. land, then tint the land.
      const height = fbm(cx * 1.9, cy * 1.9, 5);
      if (height < 0.47) {
        out.intensity = 0.05 + height * 0.55;
        out.relief = 0.3; // flat sea level
        out.detail = 0;
        return;
      }
      const vegetation = fbm(cx * 6 + 40, cy * 6 + 40, 3);
      out.intensity = 0.58 + (vegetation > 0.5 ? 0.12 : 0.34) + (height - 0.47) * 0.4;
      // Continental rise plus the vegetation octave doubling as mountain grain.
      out.relief = 0.3 + (height - 0.47) * 2.4 + vegetation * 0.2;
      out.detail = vegetation;
      return;
    }
    case 'rocky':
    default: {
      const base = fbm(cx * 2.2, cy * 2.2, 5);
      const fine = fbm(cx * 9, cy * 9, 2);
      out.intensity = base * 0.8 + fine * 0.2;
      out.relief = base * 0.75 + fine * 0.25;
      out.detail = fine;
    }
  }
};

/** How hard the normal map bites, per surface archetype. */
const RELIEF_SCALE: Record<SurfaceSpec['kind'], number> = {
  rocky: 1,
  earth: 0.85,
  gas: 0.3,
  star: 0.2,
};

interface Crater {
  readonly x: number;
  readonly y: number;
  readonly r: number;
}

/**
 * Plan the crater field once, so the colour stamp and the elevation field agree
 * on where every crater is. Previously this used Math.random() at paint time,
 * which meant craters moved on each reload and could never be given real relief.
 */
const planCraters = (count: number, width: number, height: number, rng: () => number): Crater[] => {
  const craters: Crater[] = [];
  for (let i = 0; i < count; i += 1) {
    craters.push({
      x: rng() * width,
      y: height * 0.5 + (rng() - 0.5) * height * 0.92,
      // Biased small: a few large basins, many little pockmarks.
      r: (1.6 + Math.pow(rng(), 2.6) * 15) * (width / SURFACE_WIDTH),
    });
  }
  return craters;
};

/** Stamp weathered impact craters over the noise field. */
const drawCraters = (ctx: CanvasRenderingContext2D, craters: readonly Crater[]): void => {
  for (const { x, y, r } of craters) {
    const gradient = ctx.createRadialGradient(x, y, r * 0.15, x, y, r);
    gradient.addColorStop(0, 'rgba(255,255,255,0.10)'); // raised rim catching light
    gradient.addColorStop(0.55, 'rgba(0,0,0,0.30)'); // shadowed floor
    gradient.addColorStop(1, 'rgba(255,255,255,0.06)'); // ejecta blanket

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
};

/**
 * Carve the same craters into the elevation field: a parabolic bowl inside a
 * raised rim. This is what puts a real lit/shadowed edge on every crater along
 * the terminator instead of a painted-on ring.
 */
const carveCraters = (
  height: Float32Array,
  craters: readonly Crater[],
  width: number,
  rows: number,
): void => {
  for (const { x, y, r } of craters) {
    const depth = Math.min(0.5, 0.16 + r * 0.012);
    const x0 = Math.floor(x - r);
    const x1 = Math.ceil(x + r);
    const y0 = Math.max(0, Math.floor(y - r));
    const y1 = Math.min(rows - 1, Math.ceil(y + r));

    for (let py = y0; py <= y1; py += 1) {
      for (let px = x0; px <= x1; px += 1) {
        const dx = px - x;
        const dy = py - y;
        const d = Math.sqrt(dx * dx + dy * dy) / r;
        if (d > 1) continue;

        // Bowl out to 0.8, rim ridge from 0.8 → 1.0.
        const profile =
          d < 0.8
            ? -(1 - (d / 0.8) * (d / 0.8)) * depth
            : Math.sin((1 - d) / 0.2 * Math.PI) * depth * 0.45;

        // Wrap horizontally so craters straddling the seam stay whole.
        const wrapped = ((px % width) + width) % width;
        height[py * width + wrapped] += profile;
      }
    }
  }
};

/** A long-lived anticyclone (Jupiter's Red Spot, Neptune's Dark Spot). */
const drawSpot = (
  ctx: CanvasRenderingContext2D,
  tone: 'light' | 'dark',
  width: number,
  height: number,
): void => {
  const cx = width * 0.68;
  const cy = height * 0.62;
  const rx = width * 0.1;
  const ry = height * 0.075;

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
const drawClouds = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  rng: () => number,
): void => {
  const scale = width / SURFACE_WIDTH;
  ctx.globalAlpha = 0.3;
  for (let i = 0; i < 190; i += 1) {
    const cx = rng() * width;
    const cy = height * 0.5 + (rng() - 0.5) * height * 0.85;
    const radius = (5 + rng() * 24) * scale;

    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    gradient.addColorStop(0, 'rgba(255,255,255,0.55)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * (0.5 + rng()), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
};

/* ==========================================================================
   Albedo
   ========================================================================== */

/** Everything one noise pass yields: the colour map plus two scalar fields. */
interface SurfaceFields {
  readonly albedo: HTMLCanvasElement;
  readonly height: Float32Array;
  readonly roughness: Float32Array;
}

/**
 * The single expensive pass. Walks the surface once and emits colour,
 * elevation and roughness together.
 */
const buildFields = (
  spec: SurfaceSpec,
  width: number,
  rows: number,
  seed: number,
  craters: readonly Crater[],
  rng: () => number,
): SurfaceFields => {
  const canvas = createCanvas(width, rows);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable — cannot paint surfaces.');

  const image = ctx.createImageData(width, rows);
  const pixels = image.data;

  const height = new Float32Array(width * rows);
  const roughness = new Float32Array(width * rows);

  // --- Hoisted out of the inner loop ---------------------------------------
  // Everything below exists to keep the per-pixel body allocation-free and
  // trig-free. At three hundred thousand pixels a body, an array literal or a
  // Math.cos per pixel is not a rounding error — between them they were about
  // a third of the paint cost.

  // The colour ramp, flattened: sampling it returned a fresh [r,g,b] per pixel.
  const ramp = spec.palette.map(hexToRgb);
  const rampFlat = new Float64Array(ramp.length * 3);
  for (let i = 0; i < ramp.length; i += 1) {
    rampFlat[i * 3] = ramp[i][0];
    rampFlat[i * 3 + 1] = ramp[i][1];
    rampFlat[i * 3 + 2] = ramp[i][2];
  }
  const lastStop = ramp.length - 1;

  // `cylindricalSample`'s trig depends only on the column, so it is a per-x
  // table rather than a per-pixel computation. This is also what made the
  // lattice-hash memo useless: cy still advances with every column.
  const cosTable = new Float64Array(width);
  const sinTable = new Float64Array(width);
  for (let x = 0; x < width; x += 1) {
    const theta = (x / width) * Math.PI * 2;
    cosTable[x] = Math.cos(theta) * 2.4 + seed;
    sinTable[x] = Math.sin(theta) * 2.4 + seed;
  }

  // One reused record — a fresh object per pixel would be a third of a million
  // allocations per body and a guaranteed GC pause mid-boot.
  const sample: SurfaceSample = { intensity: 0, relief: 0, detail: 0 };

  // Base roughness per archetype; Earth splits by sea level below.
  const baseRoughness =
    spec.kind === 'gas' ? 0.68 : spec.kind === 'star' ? 1 : 0.9;

  for (let y = 0; y < rows; y += 1) {
    const v = y / rows;
    const latitude = (v - 0.5) * 2; // −1 (north) … +1 (south)
    const poleShade = 1 - Math.pow(Math.abs(latitude), 3) * 0.18;
    const vShift = v * 7;

    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const cx = cosTable[x];
      const cy = sinTable[x] + vShift;

      sampleSurface(spec, cx, cy, v, sample);

      // Inlined ramp lookup — identical maths to sampleRamp, no allocation.
      const t = sample.intensity < 0 ? 0 : sample.intensity > 0.9999 ? 0.9999 : sample.intensity;
      const scaled = t * lastStop;
      const stop = scaled | 0;
      const frac = scaled - stop;
      const lo = stop * 3;
      const hi = (stop < lastStop ? stop + 1 : lastStop) * 3;
      let r = rampFlat[lo] + (rampFlat[hi] - rampFlat[lo]) * frac;
      let g = rampFlat[lo + 1] + (rampFlat[hi + 1] - rampFlat[lo + 1]) * frac;
      let b = rampFlat[lo + 2] + (rampFlat[hi + 2] - rampFlat[lo + 2]) * frac;

      height[index] = sample.relief;

      // Sea level was pinned to 0.3 in sampleSurface. Smooth water is what
      // gives Earth a real specular glint instead of a matte blue disc.
      let rough =
        spec.kind === 'earth' ? (sample.relief <= 0.305 ? 0.22 : 0.88) : baseRoughness;

      // Polar ice, feathered by latitude and broken up by noise. Smoother and
      // brighter than the rock it covers, so it is a colour *and* a roughness
      // event — one `caps` evaluation serves both.
      if (spec.caps) {
        const capEdge = 1 - spec.caps * 2;
        const k = (Math.abs(latitude) - capEdge) / Math.max(0.001, 1 - capEdge);
        if (k > 0) {
          const feather = Math.min(1, k * 1.6);
          const mix = feather * (0.55 + fbm(cx * 8, cy * 8, 2) * 0.45);
          r += (244 - r) * mix;
          g += (248 - g) * mix;
          b += (255 - b) * mix;
          rough += (0.42 - rough) * feather;
        }
      }

      // Never perfectly uniform — real surfaces are patchy at every scale.
      // Reuses the high-frequency octave already computed, not fresh noise.
      roughness[index] = Math.max(0, Math.min(1, rough + (sample.detail - 0.5) * 0.14));

      // Slight darkening toward the poles reads as sphericity even unlit.
      const offset = index * 4;
      pixels[offset] = r * poleShade;
      pixels[offset + 1] = g * poleShade;
      pixels[offset + 2] = b * poleShade;
      pixels[offset + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);

  if (craters.length) {
    drawCraters(ctx, craters);
    carveCraters(height, craters, width, rows);
  }
  if (spec.spot) drawSpot(ctx, spec.spot, width, rows);
  if (spec.kind === 'earth') drawClouds(ctx, width, rows, rng);

  return { albedo: canvas, height, roughness };
};

/* ==========================================================================
   Derived PBR maps
   ========================================================================== */

/** Tangent-space normals via Sobel over the elevation field. */
const paintNormal = (
  height: Float32Array,
  width: number,
  rows: number,
  strength: number,
): HTMLCanvasElement => {
  const canvas = createCanvas(width, rows);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable — cannot derive normals.');

  const image = ctx.createImageData(width, rows);
  const pixels = image.data;
  const at = (x: number, y: number): number =>
    height[Math.min(rows - 1, Math.max(0, y)) * width + (((x % width) + width) % width)];

  for (let y = 0; y < rows; y += 1) {
    // Longitude lines converge at the poles, so a fixed-width horizontal
    // difference represents less and less ground. Without this the poles turn
    // into a normal-map hurricane.
    const latitude = (y / rows - 0.5) * Math.PI;
    const converge = Math.max(0.15, Math.cos(latitude));

    for (let x = 0; x < width; x += 1) {
      const dx = (at(x - 1, y) - at(x + 1, y)) * strength * converge;
      const dy = (at(x, y - 1) - at(x, y + 1)) * strength;

      const length = Math.hypot(dx, dy, 1);
      const offset = (y * width + x) * 4;
      pixels[offset] = ((dx / length) * 0.5 + 0.5) * 255;
      pixels[offset + 1] = ((dy / length) * 0.5 + 0.5) * 255;
      pixels[offset + 2] = (1 / length) * 0.5 * 255 + 127.5;
      pixels[offset + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
  return canvas;
};

/** Separable box blur — the low-frequency reference an AO cavity map needs. */
const blurField = (source: Float32Array, width: number, rows: number, radius: number): Float32Array => {
  const horizontal = new Float32Array(source.length);
  const output = new Float32Array(source.length);
  const span = radius * 2 + 1;

  for (let y = 0; y < rows; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let k = -radius; k <= radius; k += 1) {
        sum += source[row + ((((x + k) % width) + width) % width)];
      }
      horizontal[row + x] = sum / span;
    }
  }

  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < rows; y += 1) {
      let sum = 0;
      for (let k = -radius; k <= radius; k += 1) {
        sum += horizontal[Math.min(rows - 1, Math.max(0, y + k)) * width + x];
      }
      output[y * width + x] = sum / span;
    }
  }

  return output;
};

/**
 * Cavity-style ambient occlusion.
 *
 * Anywhere the surface sits below its own neighbourhood — crater floors, rift
 * valleys, the troughs between cloud bands — receives less sky light. This is
 * what stops high-frequency relief from looking like a decal.
 */
const paintOcclusion = (
  height: Float32Array,
  width: number,
  rows: number,
  intensity: number,
): HTMLCanvasElement => {
  const canvas = createCanvas(width, rows);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable — cannot derive occlusion.');

  const reference = blurField(height, width, rows, Math.max(2, Math.round(width / 128)));
  const image = ctx.createImageData(width, rows);
  const pixels = image.data;

  for (let i = 0; i < height.length; i += 1) {
    const cavity = Math.max(0, reference[i] - height[i]);
    const ao = Math.max(0, Math.min(1, 1 - cavity * intensity));
    const value = ao * 255;
    const offset = i * 4;
    pixels[offset] = value;
    pixels[offset + 1] = value;
    pixels[offset + 2] = value;
    pixels[offset + 3] = 255;
  }

  ctx.putImageData(image, 0, 0);
  return canvas;
};

/** Encode a 0…1 scalar field as a grey canvas (Three reads roughness from .g). */
const encodeField = (field: Float32Array, width: number, rows: number): HTMLCanvasElement => {
  const canvas = createCanvas(width, rows);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable — cannot encode a map.');

  const image = ctx.createImageData(width, rows);
  const pixels = image.data;

  for (let i = 0; i < field.length; i += 1) {
    const value = Math.max(0, Math.min(1, field[i])) * 255;
    const offset = i * 4;
    pixels[offset] = value;
    pixels[offset + 1] = value;
    pixels[offset + 2] = value;
    pixels[offset + 3] = 255;
  }

  ctx.putImageData(image, 0, 0);
  return canvas;
};

/* ==========================================================================
   Public API
   ========================================================================== */

/** The full PBR set for one body, all derived from a single elevation pass. */
export interface SurfaceMaps {
  readonly map: CanvasTexture;
  readonly normalMap: CanvasTexture;
  readonly roughnessMap: CanvasTexture;
  readonly aoMap: CanvasTexture;
  /** True where the body has smooth, water-like regions worth a specular hit. */
  readonly hasWater: boolean;
}

/** Seed the noise field from the palette: distinct per body, stable per reload. */
const seedFor = (spec: SurfaceSpec): number => {
  const ramp = spec.palette.map(hexToRgb);
  return hash2(spec.palette.length * 7.3, ramp[0][0]) * 100;
};

/**
 * Build the full PBR set for one body.
 *
 * `width` exists so callers can buy less detail where it cannot be seen —
 * the fifteen moons share three materials and are never more than a few dozen
 * pixels across, so they take the legacy size and save a second of boot.
 */
export const createSurfaceMaps = (spec: SurfaceSpec, width = PBR_WIDTH): SurfaceMaps => {
  const rows = width >> 1;

  const seed = seedFor(spec);
  const rng = makeRng(Math.floor(seed * 7919) + spec.palette.length);
  const craters = spec.craters ? planCraters(spec.craters, width, rows, rng) : [];

  const { albedo, height, roughness } = buildFields(spec, width, rows, seed, craters, rng);
  const relief = RELIEF_SCALE[spec.kind] ?? 1;

  return {
    map: finalise(albedo, true),
    normalMap: finalise(paintNormal(height, width, rows, relief * 26), true, NoColorSpace),
    roughnessMap: finalise(encodeField(roughness, width, rows), true, NoColorSpace),
    aoMap: finalise(paintOcclusion(height, width, rows, relief * 2.4), true, NoColorSpace),
    hasWater: spec.kind === 'earth',
  };
};

/**
 * Colour-only surface map.
 *
 * Retained for the Sun, whose surface is an emissive shader that never consults
 * a normal or a roughness value — building the PBR set for it would be waste.
 */
export const createSurfaceTexture = (spec: SurfaceSpec): CanvasTexture => {
  const seed = seedFor(spec);
  const rng = makeRng(Math.floor(seed * 7919) + spec.palette.length);
  const craters = spec.craters
    ? planCraters(spec.craters, SURFACE_WIDTH, SURFACE_HEIGHT, rng)
    : [];

  const { albedo } = buildFields(spec, SURFACE_WIDTH, SURFACE_HEIGHT, seed, craters, rng);
  return finalise(albedo, true);
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
  const width = 1024;
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
