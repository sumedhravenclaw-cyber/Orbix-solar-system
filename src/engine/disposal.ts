import { Material, type Object3D, type Texture } from 'three';

/**
 * GPU resource bookkeeping.
 *
 * Three.js never garbage collects GPU memory: geometries, materials and
 * textures survive until `.dispose()` is called explicitly. In a React app this
 * matters twice over — StrictMode mounts every effect twice in development, so
 * a leaky teardown doubles VRAM on the very first render.
 *
 * Everything the engine allocates is registered here and released in one pass.
 */
export class DisposalRegistry {
  readonly #disposables = new Set<{ dispose(): void }>();
  readonly #teardowns = new Set<() => void>();

  /** Register any Three.js object exposing dispose(). Returns it unchanged. */
  track<T extends { dispose(): void }>(resource: T): T {
    this.#disposables.add(resource);
    return resource;
  }

  /** Register a plain cleanup callback (event listeners, observers, timers). */
  onTeardown(teardown: () => void): void {
    this.#teardowns.add(teardown);
  }

  /**
   * Walk a subtree and register every geometry, material and bound texture.
   * Cheaper than remembering to track each resource at its creation site.
   */
  trackSubtree(root: Object3D): void {
    root.traverse((object) => {
      const mesh = object as Object3D & {
        geometry?: { dispose(): void };
        material?: Material | Material[];
      };

      if (mesh.geometry) this.track(mesh.geometry);
      if (!mesh.material) return;

      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        this.track(material);
        for (const texture of texturesOf(material)) this.track(texture);
      }
    });
  }

  /** Release everything, once. Safe to call twice. */
  dispose(): void {
    for (const teardown of this.#teardowns) {
      try {
        teardown();
      } catch (error) {
        console.error('[orbix] teardown failed', error);
      }
    }
    this.#teardowns.clear();

    for (const resource of this.#disposables) resource.dispose();
    this.#disposables.clear();
  }
}

/** Every Texture-valued property hanging off a material. */
function texturesOf(material: Material): Texture[] {
  const found: Texture[] = [];
  for (const value of Object.values(material as unknown as Record<string, unknown>)) {
    if (value && typeof value === 'object' && (value as Texture).isTexture) {
      found.push(value as Texture);
    }
  }
  return found;
}

/**
 * Hand control back to the browser so the loading veil can paint between
 * expensive build steps, keeping the main thread under its frame budget.
 * Uses the Scheduler API where available and falls back to a macrotask.
 */
export const yieldToBrowser = (): Promise<void> => {
  const scheduler = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (typeof scheduler?.yield === 'function') return scheduler.yield();
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
};
