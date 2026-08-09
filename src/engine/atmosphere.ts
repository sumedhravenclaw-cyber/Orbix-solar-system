import {
  AdditiveBlending,
  BackSide,
  Color,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three';

/**
 * Atmospheric limb scattering.
 *
 * A slightly larger back-faced shell around the planet. Four terms decide what
 * each fragment contributes:
 *
 *   depth   — optical path length through the shell, maximum edge-on (Fresnel).
 *             Atmosphere is optically thick at a glancing angle, which is why a
 *             planet's limb glows and the middle of its disc does not.
 *   lit     — how much sunlight that patch receives. Without this the night
 *             side glows as brightly as the day side, the tell-tale sign of a
 *             fake atmosphere.
 *   sunset  — long slant paths near the terminator scatter blue away first, so
 *             the limb reddens exactly where day meets night. This band is the
 *             single strongest cue that the shell is air and not a decal.
 *   forward — Mie forward scattering. Looking through the atmosphere toward the
 *             Sun produces a pronounced bright halo.
 *
 * Rendering back faces with additive blending and no depth write means the
 * shell reads as light scattered *around* the planet rather than a bubble
 * drawn on top of it.
 */

const vertexShader = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vWorldNormal   = normalize(mat3(modelMatrix) * normal);
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position    = projectionMatrix * viewMatrix * vec4(vWorldPosition, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3  uColor;
  uniform vec3  uSunsetColor;
  uniform vec3  uSunPosition;
  uniform float uIntensity;
  uniform float uPower;

  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vec3 normal   = normalize(vWorldNormal);
    vec3 toCamera = normalize(cameraPosition - vWorldPosition);
    vec3 toSun    = normalize(uSunPosition - vWorldPosition);

    // Back faces point away from us, hence the absolute value.
    float grazing = clamp(1.0 - abs(dot(normal, toCamera)), 0.0, 1.0);
    float depth   = pow(grazing, uPower);

    float sunAlign = dot(normal, toSun);

    // Soft terminator with a little wrap: air scatters light a few degrees past
    // the geometric edge, so the glow fades out instead of stopping dead.
    float lit = smoothstep(-0.42, 0.38, sunAlign);

    // Peaks in the narrow band where the Sun is grazing the surface.
    float sunset = smoothstep(0.5, -0.02, sunAlign) * smoothstep(-0.42, -0.04, sunAlign);
    vec3  tint   = mix(uColor, uSunsetColor, sunset * 0.85);

    // Mie forward lobe — strongest when the camera looks down-sun.
    float forward = pow(clamp(dot(toCamera, toSun), 0.0, 1.0), 6.0);

    float alpha = depth * lit * uIntensity * (1.0 + forward * 0.85);
    if (alpha < 0.002) discard;

    gl_FragColor = vec4(tint, alpha);
  }
`;

export interface AtmosphereShell {
  readonly mesh: Mesh;
  readonly material: ShaderMaterial;
}

export const createAtmosphere = (
  planetRadius: number,
  color: string,
  { thickness = 0.055, intensity = 0.9, power = 2.4 } = {},
): AtmosphereShell => {
  // The sunset band is the body's own air colour pushed toward the warm end,
  // so each planet reddens in its own hue rather than all sharing one orange.
  const sunset = new Color(color).lerp(new Color(0xff7a3c), 0.72);

  const material = new ShaderMaterial({
    uniforms: {
      uColor: { value: new Color(color) },
      uSunsetColor: { value: sunset },
      uSunPosition: { value: new Vector3(0, 0, 0) },
      uIntensity: { value: intensity },
      uPower: { value: power },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: BackSide,
  });

  const mesh = new Mesh(new SphereGeometry(planetRadius * (1 + thickness), 64, 48), material);
  mesh.name = 'atmosphere';
  // Drawn after the planet so the additive blend lands on top of the surface.
  mesh.renderOrder = 1;

  return { mesh, material };
};
