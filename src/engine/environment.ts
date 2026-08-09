import {
  DataTexture,
  EquirectangularReflectionMapping,
  FloatType,
  LinearFilter,
  PMREMGenerator,
  RGBAFormat,
  type Texture,
  type WebGLRenderer,
} from 'three';

/**
 * Image-based ambient light.
 *
 * A flat AmbientLight adds the same value to every fragment, which is the one
 * thing real ambient light never does: it flattens exactly the shading that
 * makes a sphere read as a sphere. Replacing it with a pre-filtered environment
 * gives three things at once —
 *
 *   • ambient that varies with surface direction, so the unlit hemisphere still
 *     has form instead of turning into a flat silhouette;
 *   • a grazing specular response along the limb, which is most of why a
 *     rendered planet looks like a physical object rather than a decal;
 *   • a cheap stand-in for one bounce of global illumination.
 *
 * There is deliberately no sun lobe in here. The Sun is a real PointLight at
 * the origin and every planet orbits it, so baking a fixed bright direction
 * into the environment would fight the actual key light half the year.
 *
 * The map is generated at 64×32 because PMREM immediately blurs it into a
 * mip chain — spending more resolution on an input that is about to become a
 * cosine-convolved irradiance map buys nothing.
 */

const WIDTH = 64;
const HEIGHT = 32;

/** Deep space, with the faint warm band of zodiacal light near the ecliptic. */
const paintSkyData = (): Float32Array => {
  const data = new Float32Array(WIDTH * HEIGHT * 4);

  for (let y = 0; y < HEIGHT; y += 1) {
    // +1 at the north pole → −1 at the south.
    const latitude = 1 - (y / (HEIGHT - 1)) * 2;
    // Concentrated toward the ecliptic plane.
    const band = Math.pow(1 - Math.abs(latitude), 3);

    for (let x = 0; x < WIDTH; x += 1) {
      const longitude = (x / WIDTH) * Math.PI * 2;
      // One broad brightening, so ambient is not perfectly rotationally flat.
      const drift = 0.5 + 0.5 * Math.cos(longitude - 1.1);

      const glow = band * (0.55 + drift * 0.45);
      const offset = (y * WIDTH + x) * 4;

      // Cool base, warming slightly into the band — values stay well under 1
      // because this is ambient fill, not a key light.
      data[offset] = 0.012 + glow * 0.055;
      data[offset + 1] = 0.017 + glow * 0.045;
      data[offset + 2] = 0.032 + glow * 0.04;
      data[offset + 3] = 1;
    }
  }

  return data;
};

export interface EnvironmentBuild {
  readonly texture: Texture;
  dispose(): void;
}

/**
 * Build the pre-filtered environment. Assign the result to `scene.environment`
 * (never `scene.background` — the starfield owns the backdrop).
 */
export const createEnvironment = (renderer: WebGLRenderer): EnvironmentBuild => {
  const source = new DataTexture(paintSkyData(), WIDTH, HEIGHT, RGBAFormat, FloatType);
  source.mapping = EquirectangularReflectionMapping;
  source.minFilter = LinearFilter;
  source.magFilter = LinearFilter;
  source.needsUpdate = true;

  const pmrem = new PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const target = pmrem.fromEquirectangular(source);

  // The source and the generator have both done their job once the render
  // target exists; only the filtered texture is needed from here on.
  source.dispose();
  pmrem.dispose();

  return {
    texture: target.texture,
    dispose: () => target.dispose(),
  };
};
