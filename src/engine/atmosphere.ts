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
 * Atmospheric limb glow.
 *
 * A slightly larger back-faced shell around the planet. Two terms decide how
 * bright each fragment is:
 *
 *   rim  — how edge-on the surface is to the camera (Fresnel). Atmosphere is
 *          optically thick at a glancing angle, which is why a planet's limb
 *          glows and its centre does not.
 *   lit  — how much sunlight that patch receives. Without this the night side
 *          would glow just as brightly as the day side, which is the tell-tale
 *          sign of a fake atmosphere.
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
  uniform vec3  uSunPosition;
  uniform float uIntensity;
  uniform float uPower;

  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vec3 normal    = normalize(vWorldNormal);
    vec3 toCamera  = normalize(cameraPosition - vWorldPosition);
    vec3 toSun     = normalize(uSunPosition - vWorldPosition);

    // Back faces point away from us, hence the negated dot product.
    float rim = pow(clamp(1.0 - abs(dot(normal, toCamera)), 0.0, 1.0), uPower);

    // Soft terminator, with a little wrap so the glow dies just past the edge
    // of the lit hemisphere instead of stopping dead.
    float lit = smoothstep(-0.35, 0.45, dot(normal, toSun));

    float alpha = rim * lit * uIntensity;
    if (alpha < 0.002) discard;

    gl_FragColor = vec4(uColor, alpha);
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
  const material = new ShaderMaterial({
    uniforms: {
      uColor: { value: new Color(color) },
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

  const mesh = new Mesh(new SphereGeometry(planetRadius * (1 + thickness), 48, 32), material);
  mesh.name = 'atmosphere';
  // Drawn after the planet so the additive blend lands on top of the surface.
  mesh.renderOrder = 1;

  return { mesh, material };
};
