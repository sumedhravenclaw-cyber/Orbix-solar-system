import { Raycaster, Vector2, type Mesh, type PerspectiveCamera } from 'three';

import type { BodyKey } from '../data/bodies';

/**
 * Pointer → body resolution.
 *
 * Two problems this solves:
 *
 *  1. Drag vs. click. Orbiting the camera ends in a pointerup over a planet;
 *     without a movement threshold every camera drag would also select
 *     something. Anything past DRAG_THRESHOLD_PX is a drag, not a click.
 *  2. Hover cost. Raycasting on every pointermove is wasteful, so moves are
 *     sampled at most once per animation frame.
 */

const DRAG_THRESHOLD_PX = 6;

export interface PickerCallbacks {
  onSelect(key: BodyKey): void;
  onHoverChange(key: BodyKey | null): void;
}

export class Picker {
  readonly #raycaster = new Raycaster();
  readonly #ndc = new Vector2();
  readonly #element: HTMLElement;
  readonly #camera: PerspectiveCamera;
  readonly #callbacks: PickerCallbacks;

  #targets: Mesh[] = [];
  #keyByPickId = new Map<number, BodyKey>();

  #downX = 0;
  #downY = 0;
  #hovered: BodyKey | null = null;
  #hoverQueued = false;
  #pendingHover: { x: number; y: number } | null = null;

  constructor(element: HTMLElement, camera: PerspectiveCamera, callbacks: PickerCallbacks) {
    this.#element = element;
    this.#camera = camera;
    this.#callbacks = callbacks;

    element.addEventListener('pointerdown', this.#handlePointerDown);
    element.addEventListener('pointerup', this.#handlePointerUp);
    element.addEventListener('pointermove', this.#handlePointerMove);
    element.addEventListener('pointerleave', this.#handlePointerLeave);
  }

  /**
   * Register everything that can be picked — planets and moons alike.
   *
   * Hidden moon systems raycast to nothing anyway (Three.js skips invisible
   * subtrees), so the LOD rule doubles as pick filtering for free.
   */
  setBodies(targets: readonly { key: BodyKey; pick: Mesh }[]): void {
    this.#targets = targets.map((target) => target.pick);
    this.#keyByPickId = new Map(targets.map((target) => [target.pick.id, target.key]));
  }

  get hovered(): BodyKey | null {
    return this.#hovered;
  }

  dispose(): void {
    this.#element.removeEventListener('pointerdown', this.#handlePointerDown);
    this.#element.removeEventListener('pointerup', this.#handlePointerUp);
    this.#element.removeEventListener('pointermove', this.#handlePointerMove);
    this.#element.removeEventListener('pointerleave', this.#handlePointerLeave);
    this.#element.style.cursor = '';
  }

  #resolve(clientX: number, clientY: number): BodyKey | null {
    const rect = this.#element.getBoundingClientRect();
    this.#ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.#ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.#raycaster.setFromCamera(this.#ndc, this.#camera);
    const hits = this.#raycaster.intersectObjects(this.#targets, false);
    if (hits.length === 0) return null;

    return this.#keyByPickId.get(hits[0].object.id) ?? null;
  }

  #handlePointerDown = (event: PointerEvent): void => {
    this.#downX = event.clientX;
    this.#downY = event.clientY;
  };

  #handlePointerUp = (event: PointerEvent): void => {
    const travelled = Math.hypot(event.clientX - this.#downX, event.clientY - this.#downY);
    if (travelled > DRAG_THRESHOLD_PX) return; // that was a camera drag

    const key = this.#resolve(event.clientX, event.clientY);
    if (key) this.#callbacks.onSelect(key);
  };

  /** Coalesce moves to one raycast per frame. */
  #handlePointerMove = (event: PointerEvent): void => {
    if (event.pointerType === 'touch') return; // touch has no hover state

    this.#pendingHover = { x: event.clientX, y: event.clientY };
    if (this.#hoverQueued) return;

    this.#hoverQueued = true;
    requestAnimationFrame(() => {
      this.#hoverQueued = false;
      const point = this.#pendingHover;
      if (!point) return;

      this.#setHovered(this.#resolve(point.x, point.y));
    });
  };

  #handlePointerLeave = (): void => {
    this.#pendingHover = null;
    this.#setHovered(null);
  };

  #setHovered(key: BodyKey | null): void {
    if (key === this.#hovered) return;
    this.#hovered = key;
    this.#element.style.cursor = key ? 'pointer' : '';
    this.#callbacks.onHoverChange(key);
  }
}
