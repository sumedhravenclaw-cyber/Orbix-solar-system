import { useSyncExternalStore } from 'react';

import type { Telemetry } from '../engine/types';
import { useSimulationActions } from '../state/contexts';

/**
 * Subscribe to engine telemetry (elapsed years, hovered body).
 *
 * `useSyncExternalStore` is the correct primitive here: the engine is an
 * external mutable source, and the store contract guarantees React never
 * renders a torn value. The engine publishes a *new frozen object* only when a
 * displayed value actually changes, so identity comparison does the throttling
 * for us — a component calling this re-renders ~8 times a second at most,
 * never 60.
 *
 * Only components that display telemetry should call this.
 */
export const useTelemetry = (): Telemetry => {
  const { subscribeTelemetry, getTelemetry } = useSimulationActions();
  return useSyncExternalStore(subscribeTelemetry, getTelemetry, getTelemetry);
};
