import type { Group, Line, Mesh, Object3D, ShaderMaterial, Sprite } from 'three';

import type { BodyDatum, BodyKey, MoonDatum, PlanetKey } from '../data/bodies';
import type { EllipseGeometry } from './scale';

/**
 * A planet or star as the renderer sees it.
 *
 * `anchor` is the single source of truth for position: labels, the picker, the
 * camera director and the reticle all read from it, so they can never disagree
 * about where a body is.
 */
export interface SceneBody {
  readonly datum: BodyDatum;
  /** Rendered sphere radius, scene units. */
  readonly radius: number;
  /** Object that rides the orbit; parent of everything visual. */
  readonly anchor: Object3D;
  /** Tilted parent of the sphere, so the spin axis leans correctly.
   *  Null for the Sun, which has no meaningful tilt in this model. */
  readonly tiltGroup: Group | null;
  readonly mesh: Mesh;
  /** Oversized invisible sphere; the only thing the raycaster tests. */
  readonly pick: Mesh;
  readonly orbitLine: Line | null;
  readonly reticle: Mesh | null;
  readonly ellipse: EllipseGeometry | null;
  /** Cloud deck (Earth only); rotates faster than the surface. */
  readonly clouds: Mesh | null;
  /** Atmospheric limb shell, if the body has an atmosphere. */
  readonly atmosphere: ShaderMaterial | null;
  /** Satellite subtree; hidden until the LOD rule reveals it. */
  readonly satelliteGroup: Group | null;
  readonly moons: readonly SceneMoon[];
  /** Radians per simulated second around the Sun. */
  readonly omega: number;
  /** Radians per simulated second about its own axis. */
  readonly spin: number;
  /** Starting phase, so planets are not all lined up at t = 0. */
  readonly phase: number;
  /** Eased 1 → 1.09 hover/selection emphasis. */
  hoverScale: number;
  /** Eased 0 → 1 reveal of the satellite subtree. */
  satelliteReveal: number;
}

/** A natural satellite, orbiting inside its parent's anchor. */
export interface SceneMoon {
  readonly datum: MoonDatum;
  readonly radius: number;
  /** Rendered orbital radius about the parent, scene units. */
  readonly orbitRadius: number;
  readonly anchor: Object3D;
  readonly mesh: Mesh;
  readonly pick: Mesh;
  readonly orbitLine: Line;
  readonly omega: number;
  readonly phase: number;
}

export interface SunAssembly {
  readonly body: SceneBody;
  readonly halo: Sprite;
  readonly corona: Sprite;
  readonly surface: ShaderMaterial;
}

/** Optional scene layers the operator can switch on and off. */
export interface LayerState {
  readonly orbits: boolean;
  readonly labels: boolean;
  readonly satellites: boolean;
  readonly belt: boolean;
  readonly atmospheres: boolean;
}

export type LayerKey = keyof LayerState;

/** Values pushed from the render loop up to React, throttled. */
export interface Telemetry {
  /** Simulated Earth years since load, rounded for display. */
  readonly elapsedYears: number;
  readonly hoveredKey: BodyKey | null;
  /** Camera range to the focused body, scene units; null when unfocused. */
  readonly focusRange: number | null;
  /** How many satellites are currently resolved on screen. */
  readonly satellitesVisible: number;
  /** Smoothed frames per second. */
  readonly fps: number;
  /** Normalised planet positions for the overhead system map, −1 … 1. */
  readonly plot: readonly PlotPoint[];
}

export interface PlotPoint {
  readonly key: PlanetKey;
  readonly x: number;
  readonly y: number;
}

export interface EngineCallbacks {
  /** The user picked a body in the 3D view (not via the UI). */
  onSelect(key: BodyKey): void;
  /** Init progress, 0 → 1, plus a human-readable stage for the boot screen. */
  onProgress?(fraction: number, stage: string): void;
}

export interface EngineOptions {
  /**
   * Element the engine mounts its own <canvas> into.
   *
   * The engine creates and destroys that canvas itself rather than borrowing
   * one from React. Disposing a renderer force-loses its WebGL context, and a
   * canvas whose context has been force-lost cannot hand out a working one
   * again — so a shared canvas dies on the second mount (which StrictMode
   * performs on every dev reload).
   */
  readonly container: HTMLElement;
  readonly callbacks: EngineCallbacks;
  readonly reducedMotion: boolean;
}
