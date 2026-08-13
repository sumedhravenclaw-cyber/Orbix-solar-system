import {
  ACESFilmicToneMapping,
  MathUtils,
  MeshBasicMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  PointLight,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import { BODIES, type BodyKey, type PlanetKey } from '../data/bodies';
import { CameraDirector } from './CameraDirector';
import { isLowPowerDevice } from './capability';
import { createAsteroidBelt, type AsteroidBelt } from './createAsteroidBelt';
import { createMoonMaterials, positionMoons } from './createMoons';
import { createPlanet, positionOnOrbit } from './createPlanet';
import { createStarfield, type Starfield } from './createStarfield';
import { createSun } from './createSun';
import { DisposalRegistry, yieldToBrowser } from './disposal';
import { createEnvironment } from './environment';
import { Picker } from './Picker';
import { SUN_RADIUS, YEAR_SECONDS, orbitRadius } from './scale';
import type {
  EngineOptions,
  LayerKey,
  LayerState,
  PlotPoint,
  SceneBody,
  SceneMoon,
  SunAssembly,
  Telemetry,
} from './types';

/**
 * The imperative 3D layer.
 *
 * React never drives a frame. It calls methods here (`setPlaying`, `focus`, …)
 * and subscribes to throttled telemetry; everything per-frame stays inside this
 * class. Rendering at 60fps through React state would mean 60 re-renders a
 * second of the entire tree.
 */

/** Telemetry is republished at 8Hz, not 60 — the clock only shows 2 decimals. */
const TELEMETRY_INTERVAL = 0.125;
const MAX_FRAME_DELTA = 0.05; // clamp so a backgrounded tab cannot time-warp
const HOVER_EMPHASIS = 1.09;

/** Outermost orbit, used to normalise the overhead system map. */
const PLOT_EXTENT = orbitRadius(30.07);

/**
 * How close the camera must be, as a multiple of a planet's radius, before its
 * satellites are worth drawing. Beyond this they are sub-pixel clutter.
 */
const SATELLITE_RANGE_FACTOR = 46;

/** Layer the Sun is additionally assigned to; the bloom pass renders only it. */
const BLOOM_LAYER = 1;

/** Dolly floor when nothing is focused; per-body while something is. */
const DEFAULT_MIN_DISTANCE = 0.6;

const DEFAULT_LAYERS: LayerState = {
  orbits: true,
  labels: true,
  satellites: true,
  belt: true,
  atmospheres: true,
};

export class SolarSystemEngine {
  // --- Three.js core ---
  readonly #renderer: WebGLRenderer;
  readonly #scene = new Scene();
  readonly #camera: PerspectiveCamera;
  readonly #controls: OrbitControls;
  /** Sun-only pass feeding the bloom; never drawn to screen directly. */
  readonly #bloomComposer: EffectComposer;
  readonly #finalComposer: EffectComposer;
  readonly #bloom: UnrealBloomPass;
  readonly #container: HTMLElement;
  readonly #canvas: HTMLCanvasElement;

  // --- Subsystems ---
  readonly #registry = new DisposalRegistry();
  readonly #director: CameraDirector;
  readonly #picker: Picker;

  // --- Scene contents ---
  readonly #bodies: SceneBody[] = [];
  readonly #bodyByKey = new Map<PlanetKey, SceneBody>();
  readonly #moonByKey = new Map<BodyKey, { moon: SceneMoon; parent: SceneBody }>();
  #sun: SunAssembly | null = null;
  #starfield: Starfield | null = null;
  #belt: AsteroidBelt | null = null;

  // --- Simulation state ---
  #simulatedSeconds = 0;
  #wallSeconds = 0;
  #previousFrame = performance.now();
  #playing = true;
  #speed = 1;
  #selected: BodyKey | null = null;
  #layers: LayerState = DEFAULT_LAYERS;
  #reducedMotion: boolean;
  #disposed = false;
  #smoothedFps = 60;

  // --- Telemetry pub/sub (feeds useSyncExternalStore) ---
  readonly #listeners = new Set<() => void>();
  #telemetry: Telemetry = Object.freeze({
    elapsedYears: 0,
    hoveredKey: null,
    focusRange: null,
    satellitesVisible: 0,
    fps: 60,
    plot: [],
  });
  #sinceTelemetry = 0;

  // --- Label bookkeeping: React owns the DOM nodes, we only write transforms
  readonly #labels = new Map<BodyKey, HTMLElement>();
  readonly #projection = new Vector3();
  readonly #worldScratch = new Vector3();

  readonly #callbacks: EngineOptions['callbacks'];

  constructor({ container, callbacks, reducedMotion }: EngineOptions) {
    this.#callbacks = callbacks;
    this.#reducedMotion = reducedMotion;
    this.#container = container;

    // The engine owns this element for its whole lifetime and removes it on
    // dispose, so a remount always starts from a pristine canvas.
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';
    container.appendChild(canvas);
    this.#canvas = canvas;

    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);

    this.#renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.#renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.#renderer.setSize(width, height, false);
    this.#renderer.toneMapping = ACESFilmicToneMapping;
    // Slightly hot, so the lit hemisphere carries real highlight range and the
    // filmic shoulder does the compressing. ACES at 1.0 renders this scene flat.
    this.#renderer.toneMappingExposure = 1.18;

    // Must precede every castShadow/receiveShadow flag in the scene: without it
    // the shadow map is never allocated and all those flags are silently inert.
    //
    // PCF, not PCFSoft (deprecated in r185, silently downgrades to this anyway)
    // and not VSM, which Three does not support for PointLights — and the Sun
    // is a PointLight because it has to light planets on every side at once.
    //
    // A point-light shadow is a cube map: six extra renders of the scene per
    // frame, measured at ~7.3ms of a 16.7ms budget. That is affordable on a
    // desktop GPU and is not affordable anywhere else, so weak devices trade
    // the ring and transit shadows for the frame rate.
    const shadows = !isLowPowerDevice();
    this.#renderer.shadowMap.enabled = shadows;
    this.#renderer.shadowMap.type = PCFShadowMap;
    // Refreshed explicitly once per frame in #renderFrame — see the note there
    // for why the automatic rebuild is wrong with a two-pass composer.
    this.#renderer.shadowMap.autoUpdate = false;

    this.#camera = new PerspectiveCamera(50, width / height, 0.1, 4000);

    this.#controls = new OrbitControls(this.#camera, canvas);
    Object.assign(this.#controls, {
      enableDamping: true,
      dampingFactor: 0.055,
      rotateSpeed: 0.55,
      zoomSpeed: 0.85,
      panSpeed: 0.6,
      minDistance: DEFAULT_MIN_DISTANCE,
      maxDistance: 620,
    });
    this.#registry.track(this.#controls);

    this.#director = new CameraDirector(this.#camera, this.#controls, reducedMotion);

    // --- Post-processing ----------------------------------------------------
    // Bloom is SELECTIVE — it runs over a pass that contains the Sun and
    // nothing else.
    //
    // A whole-screen bloom cannot tell a star from a sunlit planet. It only
    // sees luminance, so as soon as a planet filled the frame its lit
    // hemisphere was blurred back across the entire image: measured at 2×
    // planet radius, 100% of pixels came out above 200 luminance — a white
    // screen. No threshold fixes that, because the planet's day side and the
    // star are the same brightness by the time the planet is close.
    //
    // Restricting the bloom input by layer fixes it at the source: the star
    // still reads as a light source, and a planet stays a lit physical object
    // however close the camera gets.
    this.#bloomComposer = new EffectComposer(this.#renderer);
    this.#bloomComposer.renderToScreen = false;
    this.#bloomComposer.addPass(new RenderPass(this.#scene, this.#camera));
    // Threshold 0: everything reaching this pass is already the Sun.
    // Strength was matched at 0.45 against the previous whole-screen bloom, then
    // eased to 0.38 alongside the photosphere's own output so the star reads as
    // hot without flaring over the inner planets.
    this.#bloom = new UnrealBloomPass(new Vector2(width, height), 0.38, 0.6, 0);
    this.#bloomComposer.addPass(this.#bloom);

    this.#finalComposer = new EffectComposer(this.#renderer);
    this.#finalComposer.addPass(new RenderPass(this.#scene, this.#camera));
    this.#finalComposer.addPass(this.#createBloomMixPass());
    this.#finalComposer.addPass(new OutputPass());

    this.#registry.track(this.#bloomComposer);
    this.#registry.track(this.#finalComposer);
    this.#registry.track(this.#bloom);

    // --- Lighting -----------------------------------------------------------
    // A single PointLight at the origin is the only meaningful source, so every
    // planet gets a real terminator that sweeps round as it orbits. decay = 0
    // keeps Neptune lit: true inverse-square across a 77× distance range would
    // leave the outer system black.
    const sun = new PointLight(0xfff1d6, 2.6, 0, 0);
    sun.castShadow = shadows;
    sun.shadow.mapSize.set(1024, 1024);
    // The cube shadow camera has to span the whole system, so depth precision
    // is thin. normalBias offsets along the surface normal instead of along the
    // light ray, which is what actually survives on spheres this curved —
    // a plain depth bias at this range either acne-stripes or peter-pans.
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 700;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.04;
    this.#scene.add(sun);

    // Ambient comes from a pre-filtered environment rather than an AmbientLight.
    // A constant added to every fragment flattens precisely the shading that
    // makes a sphere read as a sphere; an irradiance map varies with surface
    // direction and gives the limb something to reflect.
    const environment = createEnvironment(this.#renderer);
    this.#scene.environment = environment.texture;
    this.#scene.environmentIntensity = 0.6;
    this.#registry.track(environment);

    this.#picker = new Picker(canvas, this.#camera, {
      onSelect: (key) => this.#callbacks.onSelect(key),
      onHoverChange: () => this.#publishTelemetry(true),
    });
    this.#registry.track(this.#picker);

    this.#attachListeners();
  }

  /**
   * Composites the Sun-only bloom back over the beauty pass.
   *
   * Additive, and deliberately placed before OutputPass so the sum is tone
   * mapped as one image — adding glow *after* the filmic curve is what makes
   * bloom look like a sticker rather than light.
   */
  #createBloomMixPass(): ShaderPass {
    const pass = new ShaderPass(
      new ShaderMaterial({
        uniforms: {
          baseTexture: { value: null },
          bloomTexture: { value: this.#bloomComposer.renderTarget2.texture },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform sampler2D baseTexture;
          uniform sampler2D bloomTexture;
          varying vec2 vUv;
          void main() {
            gl_FragColor = texture2D(baseTexture, vUv) + texture2D(bloomTexture, vUv);
          }
        `,
      }),
      'baseTexture',
    );
    pass.needsSwap = true;
    return pass;
  }

  /**
   * Two passes: the Sun alone into the bloom buffer, then the whole scene with
   * that buffer added back.
   *
   * The shadow map is driven manually here, and it has to be. Three rebuilds it
   * inside every `render()` call, and it selects shadow casters with
   * `object.layers.test(camera.layers)` — the *view* camera's mask. Left on
   * automatic, the Sun-only pass would rebuild the map with no casters in it at
   * all (wiping the ring and transit shadows), and the second rebuild would
   * double the most expensive item in the frame. So: refresh once, on the pass
   * that can actually see the casters.
   */
  #renderFrame(): void {
    this.#camera.layers.set(BLOOM_LAYER);
    this.#bloomComposer.render();

    this.#camera.layers.set(0);
    this.#renderer.shadowMap.needsUpdate = this.#renderer.shadowMap.enabled;
    this.#finalComposer.render();
  }

  // ==========================================================================
  // Construction
  // ==========================================================================

  /**
   * Build the scene, yielding between stages.
   *
   * Painting the procedural surfaces costs about a second of solid main-thread
   * work. Yielding lets the boot screen animate and report real progress
   * instead of freezing, and lets an unmount abort part-way through.
   */
  async build(signal: AbortSignal): Promise<void> {
    const report = (fraction: number, stage: string): void => {
      this.#callbacks.onProgress?.(fraction, stage);
    };

    report(0.02, 'Seeding starfield');
    const starfield = createStarfield(this.#renderer.getPixelRatio(), this.#reducedMotion);
    this.#scene.add(starfield.points);
    this.#registry.trackSubtree(starfield.points);
    this.#starfield = starfield;
    await yieldToBrowser();
    if (signal.aborted) return;

    // One shared material for every hit sphere in the scene — planets and
    // moons alike. Identical properties, so there is no reason to pay for
    // twenty-four GPU materials.
    const pickMaterial = this.#registry.track(new MeshBasicMaterial({ visible: false }));

    report(0.08, 'Compiling satellite surfaces');
    // Registered for disposal here; nothing else needs a reference to it.
    const moonMaterials = this.#registry.track(createMoonMaterials());
    await yieldToBrowser();
    if (signal.aborted) return;

    let planetIndex = 0;

    for (const datum of BODIES) {
      if (signal.aborted) return;
      report(0.12 + (planetIndex / BODIES.length) * 0.76, `Painting ${datum.name}`);

      if (datum.key === 'sun') {
        const sun = createSun(datum, pickMaterial);
        this.#sun = sun;
        // The whole assembly — surface, halo, corona — is the only thing the
        // bloom pass is allowed to see. Everything else stays on layer 0 alone.
        sun.body.mesh.traverse((object) => object.layers.enable(BLOOM_LAYER));
        this.#scene.add(sun.body.mesh);
        this.#registry.trackSubtree(sun.body.mesh);
        this.#register(sun.body);
      } else {
        planetIndex += 1;
        const { orbitGroup, body } = createPlanet(
          datum,
          planetIndex,
          pickMaterial,
          moonMaterials,
        );
        this.#scene.add(orbitGroup);
        this.#registry.trackSubtree(orbitGroup);
        this.#register(body);
      }

      await yieldToBrowser();
    }

    if (signal.aborted) return;

    report(0.94, 'Populating the asteroid belt');
    const belt = createAsteroidBelt();
    this.#scene.add(belt.group);
    this.#registry.trackSubtree(belt.group);
    this.#belt = belt;
    await yieldToBrowser();
    if (signal.aborted) return;

    this.#picker.setBodies(this.#collectPickTargets());
    report(1, 'Orbital plane locked');

    this.#previousFrame = performance.now();
    this.#renderer.setAnimationLoop(this.#tick);
  }

  #register(body: SceneBody): void {
    this.#bodies.push(body);
    this.#bodyByKey.set(body.datum.key, body);
    for (const moon of body.moons) this.#moonByKey.set(moon.datum.key, { moon, parent: body });
  }

  /** Planets plus every moon — moons are pickable too. */
  #collectPickTargets(): { key: BodyKey; pick: SceneBody['pick'] }[] {
    const targets: { key: BodyKey; pick: SceneBody['pick'] }[] = [];
    for (const body of this.#bodies) {
      targets.push({ key: body.datum.key, pick: body.pick });
      for (const moon of body.moons) targets.push({ key: moon.datum.key, pick: moon.pick });
    }
    return targets;
  }

  #attachListeners(): void {
    // ResizeObserver rather than window.resize: it also fires when the element
    // changes size because of layout, not just because the window did.
    const observer = new ResizeObserver(() => this.#resize());
    observer.observe(this.#container);
    this.#registry.onTeardown(() => observer.disconnect());

    // Rendering into a hidden tab burns battery for nobody's benefit.
    const onVisibility = (): void => {
      if (document.hidden) {
        this.#renderer.setAnimationLoop(null);
      } else if (!this.#disposed && this.#bodies.length > 0) {
        this.#previousFrame = performance.now(); // don't jump on return
        this.#renderer.setAnimationLoop(this.#tick);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    this.#registry.onTeardown(() =>
      document.removeEventListener('visibilitychange', onVisibility),
    );
  }

  #resize(): void {
    const width = this.#container.clientWidth;
    const height = this.#container.clientHeight;
    if (width === 0 || height === 0) return;

    this.#camera.aspect = width / height;
    this.#camera.updateProjectionMatrix();
    this.#renderer.setSize(width, height, false);
    // setSize resizes the existing render targets in place, so the mix pass's
    // reference to renderTarget2.texture stays valid across a resize.
    this.#bloomComposer.setSize(width, height);
    this.#finalComposer.setSize(width, height);
    this.#bloom.setSize(width, height);
    this.#director.reframe(this.#camera.aspect);
  }

  // ==========================================================================
  // Imperative API used by React
  // ==========================================================================

  setPlaying(playing: boolean): void {
    this.#playing = playing;
  }

  setSpeed(multiplier: number): void {
    this.#speed = multiplier;
  }

  setLayers(layers: LayerState): void {
    this.#layers = layers;

    for (const body of this.#bodies) {
      if (body.orbitLine) body.orbitLine.visible = layers.orbits;
    }
    if (this.#belt) this.#belt.group.visible = layers.belt;
  }

  isLayerOn(layer: LayerKey): boolean {
    return this.#layers[layer];
  }

  setReducedMotion(reduced: boolean): void {
    this.#reducedMotion = reduced;
    this.#director.setReducedMotion(reduced);
    if (this.#starfield) this.#starfield.material.uniforms.uTwinkle.value = reduced ? 0 : 1;
  }

  /**
   * Stop the zoom before the camera reaches the body's own surface.
   *
   * The dolly limit has to be per-body: a single scene-wide floor is either
   * too far out for Mercury (radius 0.32) or far inside Jupiter (radius 2.68),
   * and once the camera is inside the sphere the near faces are back-face
   * culled and the view goes black. The multiplier clears the surface, the
   * atmosphere shell at 1.06× and the hover emphasis at 1.09× on top of it,
   * leaving the body filling the frame at closest approach.
   */
  #setApproachLimit(radius: number | null): void {
    this.#controls.minDistance = radius === null ? DEFAULT_MIN_DISTANCE : radius * 1.35;
  }

  /** Focus a body — planet or moon — or pass null to release the camera. */
  focus(key: BodyKey | null): void {
    this.#selected = key;

    for (const body of this.#bodies) {
      if (body.reticle) body.reticle.visible = body.datum.key === key;
    }

    if (key === null) {
      this.#setApproachLimit(null);
      this.#director.release();
      return;
    }

    const planet = this.#bodyByKey.get(key as PlanetKey);
    if (planet) {
      this.#setApproachLimit(planet.radius);
      this.#director.focus(planet.anchor, planet.radius);
      return;
    }

    // Focusing a moon frames the moon itself, not its parent.
    const satellite = this.#moonByKey.get(key);
    if (satellite) {
      this.#setApproachLimit(satellite.moon.radius);
      this.#director.focus(satellite.moon.anchor, satellite.moon.radius);
    }
  }

  resetView(): void {
    this.#selected = null;
    for (const body of this.#bodies) {
      if (body.reticle) body.reticle.visible = false;
    }
    this.#setApproachLimit(null);
    this.#director.home();
  }

  /**
   * Hand the engine a label element to position.
   *
   * React renders and owns these nodes; the engine only writes `transform` and
   * `opacity` on them each frame. Routing 60fps label positions through React
   * state would re-render the tree every frame for no benefit.
   */
  registerLabel(key: BodyKey, element: HTMLElement | null): void {
    if (element) this.#labels.set(key, element);
    else this.#labels.delete(key);
  }

  // --- External store contract (useSyncExternalStore) -----------------------

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  getSnapshot = (): Telemetry => this.#telemetry;

  #publishTelemetry(force = false): void {
    const elapsedYears = Number((this.#simulatedSeconds / YEAR_SECONDS).toFixed(2));
    const hoveredKey = this.#picker.hovered;

    if (
      !force &&
      elapsedYears === this.#telemetry.elapsedYears &&
      hoveredKey === this.#telemetry.hoveredKey
    ) {
      return;
    }

    let focusRange: number | null = null;
    if (this.#selected) {
      const target = this.#resolveAnchor(this.#selected);
      if (target) {
        focusRange = target
          .getWorldPosition(this.#worldScratch)
          .distanceTo(this.#camera.position);
      }
    }

    let satellitesVisible = 0;
    const plot: PlotPoint[] = [];
    for (const body of this.#bodies) {
      if (body.satelliteGroup?.visible) satellitesVisible += body.moons.length;
      if (!body.ellipse) continue;
      body.anchor.getWorldPosition(this.#worldScratch);
      plot.push({
        key: body.datum.key,
        x: this.#worldScratch.x / PLOT_EXTENT,
        y: this.#worldScratch.z / PLOT_EXTENT,
      });
    }

    // A new frozen object each time: useSyncExternalStore compares by identity.
    this.#telemetry = Object.freeze({
      elapsedYears,
      hoveredKey,
      focusRange,
      satellitesVisible,
      fps: Math.round(this.#smoothedFps),
      plot,
    });
    for (const listener of this.#listeners) listener();
  }

  #resolveAnchor(key: BodyKey) {
    return (
      this.#bodyByKey.get(key as PlanetKey)?.anchor ?? this.#moonByKey.get(key)?.moon.anchor ?? null
    );
  }

  // ==========================================================================
  // Render loop
  // ==========================================================================

  #tick = (): void => {
    const now = performance.now();
    const dt = Math.min((now - this.#previousFrame) / 1000, MAX_FRAME_DELTA);
    this.#previousFrame = now;

    // Exponential moving average: a raw 1/dt readout is unreadably jittery.
    if (dt > 0) this.#smoothedFps += (1 / dt - this.#smoothedFps) * 0.06;

    this.#wallSeconds += dt;
    const simulatedDelta = this.#playing ? dt * this.#speed : 0;
    this.#simulatedSeconds += simulatedDelta;

    this.#updateStars();
    this.#updateSun(simulatedDelta);
    this.#updateBodies(dt, simulatedDelta);
    if (this.#layers.belt) this.#belt?.update(simulatedDelta);

    this.#director.update(dt);
    this.#controls.update();

    this.#updateLabels();

    this.#sinceTelemetry += dt;
    if (this.#sinceTelemetry >= TELEMETRY_INTERVAL) {
      this.#sinceTelemetry = 0;
      this.#publishTelemetry();
    }

    this.#renderFrame();
  };

  #updateStars(): void {
    if (!this.#starfield) return;
    this.#starfield.material.uniforms.uTime.value = this.#wallSeconds;
    if (!this.#reducedMotion) {
      this.#starfield.points.rotation.y = this.#wallSeconds * 0.0016; // faint parallax
    }
  }

  #updateSun(simulatedDelta: number): void {
    if (!this.#sun) return;
    this.#sun.body.mesh.rotation.y += this.#sun.body.spin * simulatedDelta;
    this.#sun.surface.uniforms.uTime.value = this.#reducedMotion ? 0 : this.#wallSeconds;

    if (this.#reducedMotion) return;
    // Slow breathing keeps the star from looking like a static decal.
    const pulse = 1 + Math.sin(this.#wallSeconds * 0.7) * 0.02;
    this.#sun.halo.scale.setScalar(SUN_RADIUS * 2.5 * pulse);
    this.#sun.corona.scale.setScalar(SUN_RADIUS * 5.5 * pulse);
  }

  #updateBodies(dt: number, simulatedDelta: number): void {
    const hovered = this.#picker.hovered;
    const approach = Math.min(1, dt * 9);

    for (const body of this.#bodies) {
      positionOnOrbit(body, this.#simulatedSeconds);
      body.mesh.rotation.y += body.spin * simulatedDelta;

      // Clouds drift relative to the ground — the deck is a separate shell
      // precisely so it can lag and lead the surface beneath it.
      if (body.clouds) body.clouds.rotation.y += body.spin * simulatedDelta * 1.18;

      const isEmphasised = hovered === body.datum.key || this.#selected === body.datum.key;

      if (body.tiltGroup) {
        const target = isEmphasised && !this.#reducedMotion ? HOVER_EMPHASIS : 1;
        // Frame-rate independent approach, no overshoot.
        body.hoverScale = MathUtils.lerp(body.hoverScale, target, approach);
        body.tiltGroup.scale.setScalar(body.hoverScale);
      }

      if (body.orbitLine && this.#layers.orbits) {
        const material = body.orbitLine.material as { opacity: number };
        material.opacity = isEmphasised ? 0.95 : 0.34;
      }

      if (body.atmosphere) {
        body.atmosphere.visible = this.#layers.atmospheres;
      }

      this.#updateSatellites(body, approach);

      // Billboard the selection reticle so it always reads as a flat ring.
      if (body.reticle?.visible) body.reticle.lookAt(this.#camera.position);
    }
  }

  /**
   * Satellite level of detail.
   *
   * A moon system is only drawn when its parent is the focus, is hovered, or
   * the camera has simply come close enough for the moons to be more than a
   * pixel. At system overview every moon would be sub-pixel clutter drawn over
   * its own parent — and fifteen extra orbit lines crossing the ecliptic.
   */
  #updateSatellites(body: SceneBody, approach: number): void {
    const group = body.satelliteGroup;
    if (!group) return;

    if (!this.#layers.satellites) {
      group.visible = false;
      return;
    }

    const selectedHere =
      this.#selected === body.datum.key ||
      (typeof this.#selected === 'string' && this.#selected.startsWith(`${body.datum.key}:`));

    const range = body.anchor
      .getWorldPosition(this.#worldScratch)
      .distanceTo(this.#camera.position);
    const inRange = range < body.radius * SATELLITE_RANGE_FACTOR;

    const shouldShow = selectedHere || inRange || this.#picker.hovered === body.datum.key;

    body.satelliteReveal = MathUtils.lerp(body.satelliteReveal, shouldShow ? 1 : 0, approach);
    group.visible = body.satelliteReveal > 0.02;
    if (!group.visible) return;

    // Fade the traces in rather than snapping them on.
    for (const moon of body.moons) {
      const material = moon.orbitLine.material as { opacity: number };
      material.opacity = 0.35 * body.satelliteReveal;
      moon.mesh.scale.setScalar(Math.max(0.001, body.satelliteReveal));
    }

    positionMoons(body.moons, this.#simulatedSeconds);
  }

  /**
   * Project world positions into screen space and write them straight to the
   * DOM. Offsets are derived from the projected sphere radius so a label clears
   * its body at every zoom level.
   */
  #updateLabels(): void {
    if (this.#labels.size === 0) return;

    const { clientWidth: width, clientHeight: height } = this.#container;
    const fovFactor = (height * 0.5) / Math.tan(MathUtils.degToRad(this.#camera.fov * 0.5));
    const showLabels = this.#layers.labels;

    for (const body of this.#bodies) {
      this.#placeLabel(body.datum.key, body.anchor, body.radius, fovFactor, width, height, {
        visible: showLabels,
        farFade: 90,
      });

      // Moon labels ride the same path, but only while the system is revealed.
      const revealed = (body.satelliteGroup?.visible ?? false) && body.satelliteReveal > 0.5;
      for (const moon of body.moons) {
        this.#placeLabel(
          moon.datum.key,
          moon.anchor,
          moon.radius,
          fovFactor,
          width,
          height,
          { visible: showLabels && revealed, farFade: 24, ceiling: body.satelliteReveal },
        );
      }
    }
  }

  #placeLabel(
    key: BodyKey,
    anchor: SceneBody['anchor'],
    radius: number,
    fovFactor: number,
    width: number,
    height: number,
    options: { visible: boolean; farFade: number; ceiling?: number },
  ): void {
    const element = this.#labels.get(key);
    if (!element) return;

    if (!options.visible) {
      element.style.opacity = '0';
      return;
    }

    anchor.getWorldPosition(this.#projection);
    const distance = this.#projection.distanceTo(this.#camera.position);
    this.#projection.project(this.#camera);

    if (this.#projection.z > 1) {
      element.style.opacity = '0'; // behind the camera
      return;
    }

    const x = (this.#projection.x * 0.5 + 0.5) * width;
    const y = (-this.#projection.y * 0.5 + 0.5) * height;
    const screenRadius = (radius / Math.max(0.001, distance)) * fovFactor;

    // Fade distant labels so the outer system does not become text soup.
    const fade = MathUtils.clamp(1 - (distance - options.farFade) / 260, 0, 1);
    element.style.opacity = String(fade * (options.ceiling ?? 1));
    element.style.transform = `translate3d(${x.toFixed(1)}px, ${(y - screenRadius - 14).toFixed(1)}px, 0) translate(-50%, -50%)`;
  }

  // ==========================================================================
  // Teardown
  // ==========================================================================

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;

    this.#renderer.setAnimationLoop(null);
    this.#listeners.clear();
    this.#labels.clear();

    this.#registry.dispose();

    this.#scene.clear();
    this.#renderer.dispose();
    // Release the GPU context immediately rather than waiting for GC, then
    // discard the canvas with it — a force-lost canvas can never serve another
    // context, so it must not outlive this engine.
    this.#renderer.forceContextLoss();
    this.#canvas.remove();
  }
}
