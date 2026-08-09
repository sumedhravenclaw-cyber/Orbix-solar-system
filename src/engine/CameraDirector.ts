import { Vector3, type Object3D, type PerspectiveCamera } from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { framingPull } from './scale';

/**
 * Owns every camera move that is not the user's own mouse.
 *
 * Two behaviours:
 *
 *  1. FLIGHT — an eased tween toward a body. The destination is recomputed
 *     every frame because the target is still orbiting while we fly to it.
 *  2. LOCK-ON — once arrived, the camera is translated by the body's own
 *     displacement each frame. The user keeps full orbit/zoom freedom around a
 *     moving target instead of being welded to a fixed vantage point.
 *
 * The tween is interruptible: any new focus request or a reset retargets
 * immediately from wherever the camera currently is.
 */

const FLIGHT_DURATION = 1.25; // seconds
const HOME_HEIGHT = 46;
const HOME_DEPTH = 104;

/** Cubic ease-in-out — symmetric, no overshoot to fight the damping. */
const easeInOut = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export class CameraDirector {
  readonly #camera: PerspectiveCamera;
  readonly #controls: OrbitControls;

  readonly #home = new Vector3();
  readonly #homeTarget = new Vector3(0, 0, 0);

  /** Camera offset from the focused body, frozen at flight start. */
  readonly #offset = new Vector3();
  readonly #fromPosition = new Vector3();
  readonly #fromTarget = new Vector3();
  readonly #lastBodyPosition = new Vector3();
  readonly #scratch = new Vector3();

  /** Anchor being tracked — a planet's or a moon's; the director cannot tell. */
  #tracked: Object3D | null = null;
  #fixedTarget: Vector3 | null = null;
  #elapsed = 0;
  #flying = false;
  #reducedMotion: boolean;

  constructor(camera: PerspectiveCamera, controls: OrbitControls, reducedMotion: boolean) {
    this.#camera = camera;
    this.#controls = controls;
    this.#reducedMotion = reducedMotion;
    this.reframe(camera.aspect);
    this.#camera.position.copy(this.#home);
    this.#controls.target.copy(this.#homeTarget);
  }

  setReducedMotion(reduced: boolean): void {
    this.#reducedMotion = reduced;
  }

  /** Recompute the default vantage point for a new aspect ratio. */
  reframe(aspect: number): void {
    const pull = framingPull(aspect);
    this.#home.set(0, HOME_HEIGHT * pull, HOME_DEPTH * pull);
  }

  get isTracking(): boolean {
    return this.#tracked !== null;
  }

  /**
   * Fly to an anchor, then lock on.
   *
   * Takes an Object3D and a radius rather than a body, so a moon can be framed
   * exactly like a planet — the director does not need to know the difference.
   */
  focus(anchor: Object3D, radius: number): void {
    const target = anchor.getWorldPosition(new Vector3());

    // Keep the user's current viewing angle; only close the distance.
    const direction = this.#scratch.copy(this.#camera.position).sub(target);
    if (direction.lengthSq() < 1e-4) direction.set(0, 0.35, 1);
    direction.normalize();
    direction.y = Math.max(direction.y, 0.16); // never end up dead level
    direction.normalize();

    // Small bodies need a proportionally closer stand-off or they stay specks;
    // the floor keeps the camera clear of Phobos-sized targets.
    const distance = Math.max(radius * 6.5 + radius * 2, radius * 4 + 0.9);
    this.#offset.copy(direction).multiplyScalar(distance);

    this.#tracked = anchor;
    this.#fixedTarget = null;
    this.#beginFlight(target);
  }

  /** Fly back to the default overview and stop tracking. */
  home(): void {
    this.#tracked = null;
    this.reframe(this.#camera.aspect);
    this.#offset.copy(this.#home);
    this.#fixedTarget = this.#homeTarget;
    this.#beginFlight(this.#homeTarget);
  }

  /** Stop tracking but leave the camera exactly where it is. */
  release(): void {
    this.#tracked = null;
    this.#flying = false;
    this.#controls.enabled = true;
  }

  #beginFlight(target: Vector3): void {
    this.#fromPosition.copy(this.#camera.position);
    this.#fromTarget.copy(this.#controls.target);
    this.#elapsed = 0;

    if (this.#reducedMotion) {
      // No sweeping camera move — jump, which is the accessible behaviour.
      this.#applyProgress(1, target);
      this.#finishFlight();
      return;
    }

    this.#flying = true;
    // Disable user input for the flight so the two do not fight each other.
    this.#controls.enabled = false;
  }

  #applyProgress(k: number, target: Vector3): void {
    const destination = this.#scratch.copy(target).add(this.#offset);
    this.#camera.position.lerpVectors(this.#fromPosition, destination, k);
    this.#controls.target.lerpVectors(this.#fromTarget, target, k);
  }

  #finishFlight(): void {
    this.#flying = false;
    this.#controls.enabled = true;
    if (this.#tracked) this.#tracked.getWorldPosition(this.#lastBodyPosition);
  }

  /** Called once per frame, before controls.update(). */
  update(dt: number): void {
    if (this.#flying) {
      this.#elapsed = Math.min(FLIGHT_DURATION, this.#elapsed + dt);
      const k = easeInOut(this.#elapsed / FLIGHT_DURATION);

      // For a fixed destination the offset IS the absolute position, so lerp
      // straight to it; for a body we re-read its (moving) world position.
      if (this.#fixedTarget) {
        this.#camera.position.lerpVectors(this.#fromPosition, this.#offset, k);
        this.#controls.target.lerpVectors(this.#fromTarget, this.#fixedTarget, k);
      } else if (this.#tracked) {
        const target = this.#tracked.getWorldPosition(new Vector3());
        this.#applyProgress(k, target);
      }

      if (this.#elapsed >= FLIGHT_DURATION) this.#finishFlight();
      return;
    }

    if (!this.#tracked) return;

    // Lock-on: shift camera and orbit target by the body's own displacement.
    const current = this.#tracked.getWorldPosition(this.#scratch);
    const delta = current.clone().sub(this.#lastBodyPosition);
    this.#camera.position.add(delta);
    this.#controls.target.add(delta);
    this.#lastBodyPosition.copy(current);
  }
}
