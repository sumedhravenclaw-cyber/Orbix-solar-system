/**
 * Device capability, resolved once.
 *
 * Two things in this app scale badly on weak hardware, and both are decided
 * from here so they can never disagree:
 *
 *   • surface painting, which is pure main-thread noise evaluation and the
 *     whole of the boot cost;
 *   • the Sun's shadow pass, which is a PointLight cube map — six extra renders
 *     of the scene per frame. Measured at 1280×720 it costs ~7.3ms of a 16.7ms
 *     frame, so it is the single largest lever on frame rate.
 *
 * The test is deliberately crude: `hardwareConcurrency` and a coarse pointer
 * are the only signals available before anything has been drawn, and guessing
 * wrong toward "low power" costs some polish, while guessing wrong toward
 * "high power" costs a slideshow.
 */
let cached: boolean | null = null;

export const isLowPowerDevice = (): boolean => {
  if (cached !== null) return cached;

  if (typeof navigator === 'undefined') {
    cached = false;
    return cached;
  }

  const cores = navigator.hardwareConcurrency ?? 8;
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches === true;
  cached = cores <= 4 || coarsePointer;
  return cached;
};
