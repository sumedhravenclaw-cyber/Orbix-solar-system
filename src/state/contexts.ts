import { createContext, use, type RefObject } from 'react';

import type { BodyKey } from '../data/bodies';
import type { LayerKey, Telemetry } from '../engine/types';
import type { SimulationState } from './simulation';

/**
 * Context objects and their accessor hooks.
 *
 * Kept out of the provider's file on purpose: a module that exports both
 * components and non-components defeats Fast Refresh, so every edit to the
 * provider would remount the whole tree — and with it the WebGL context.
 *
 * Two contexts, not one:
 *
 *   SimulationStateContext   changes on every state update
 *   SimulationActionsContext holds only stable callbacks
 *
 * Components that merely dispatch (every button in the dock) subscribe to the
 * actions context alone and therefore never re-render when unrelated state —
 * a speed change, a new selection — moves.
 */

export interface SimulationActions {
  togglePlay(): void;
  setSpeedIndex(index: number): void;
  select(key: BodyKey | null): void;
  toggleLayer(layer: LayerKey): void;
  setQuery(value: string): void;
  resetView(): void;
  /** Hand the engine a DOM node to position each frame (or null to detach). */
  registerLabel(key: BodyKey, element: HTMLElement | null): void;
  subscribeTelemetry(listener: () => void): () => void;
  getTelemetry(): Telemetry;
}

export const SimulationStateContext = createContext<SimulationState | null>(null);
export const SimulationActionsContext = createContext<SimulationActions | null>(null);

/** The element the engine mounts its own canvas into. */
export const StageRefContext = createContext<RefObject<HTMLDivElement | null> | null>(null);

const required = <T,>(value: T | null, hook: string): T => {
  if (value === null) throw new Error(`${hook}() must be called inside <SimulationProvider>.`);
  return value;
};

export const useSimulationState = (): SimulationState =>
  required(use(SimulationStateContext), 'useSimulationState');

export const useSimulationActions = (): SimulationActions =>
  required(use(SimulationActionsContext), 'useSimulationActions');

export const useStageRef = (): RefObject<HTMLDivElement | null> =>
  required(use(StageRefContext), 'useStageRef');
