import { ShaderChunk } from 'three';
import type { MeshStandardMaterial, WebGLProgramParametersWithUniforms, WebGLRenderer } from 'three';

/**
 * Shader patches for MeshStandardMaterial.
 *
 * Editing the stock shader with `onBeforeCompile` keeps every feature of
 * MeshStandardMaterial intact — shadows, tone mapping, IBL, fog — which a
 * bespoke ShaderMaterial would throw away. The catch is that `onBeforeCompile`
 * is a single slot, so Earth (which needs night lights *and* a soft terminator)
 * would silently lose one of them. `patchShader` chains instead of replacing.
 */

type Patch = (shader: WebGLProgramParametersWithUniforms) => void;

/** Append a shader edit, preserving any already installed on the material. */
export const patchShader = (material: MeshStandardMaterial, patch: Patch): void => {
  const previous = material.onBeforeCompile;

  material.onBeforeCompile = (
    shader: WebGLProgramParametersWithUniforms,
    renderer: WebGLRenderer,
  ) => {
    previous?.call(material, shader, renderer);
    patch(shader);
  };

  material.needsUpdate = true;
};

/**
 * The chunk holding `RE_Direct_Physical`, and the exact stock line inside it
 * that computes the diffuse cosine term for a direct light.
 *
 * Both are constants so the failure mode of a Three.js upgrade is one loud
 * warning rather than a silent revert to a hard terminator.
 */
const LIGHTS_CHUNK = 'lights_physical_pars_fragment';
const DOT_NL = 'float dotNL = saturate( dot( geometryNormal, directLight.direction ) );';

/**
 * Widen the day/night transition.
 *
 * An airless body genuinely does have a near-razor terminator — the Sun is a
 * half-degree disc, so the penumbra is narrow, and Mercury should keep that.
 * A body with air does not: light entering the atmosphere at a grazing angle is
 * scattered around onto ground the direct beam never reaches, which is why the
 * Earth's terminator is a soft band tens of kilometres wide rather than a line.
 *
 * `wrap` is that band's width, 0 = untouched. Energy is renormalised by
 * (1 + wrap) so wrapping spreads the light rather than inventing more of it.
 */
export const softenTerminator = (material: MeshStandardMaterial, wrap: number): void => {
  if (wrap <= 0) return;

  patchShader(material, (shader) => {
    // `onBeforeCompile` hands over the shader *before* #include resolution, so
    // the chunk's body is not in `fragmentShader` yet — only the directive is.
    // The chunk therefore has to be expanded by hand and substituted in.
    const directive = `#include <${LIGHTS_CHUNK}>`;
    const chunk = ShaderChunk[LIGHTS_CHUNK];

    if (!chunk?.includes(DOT_NL) || !shader.fragmentShader.includes(directive)) {
      console.warn(
        `[orbix] terminator patch did not apply — Three.js changed ${LIGHTS_CHUNK}.`,
      );
      return;
    }

    const patched = chunk.replace(
      DOT_NL,
      /* glsl */ `
        float rawNL = dot( geometryNormal, directLight.direction );
        float dotNL = saturate( ( rawNL + ${wrap.toFixed(3)} ) / ${(1 + wrap).toFixed(3)} );
      `,
    );

    shader.fragmentShader = shader.fragmentShader.replace(directive, patched);
  });
};
