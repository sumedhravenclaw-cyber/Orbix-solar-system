import { useCallback, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';

import type { BodyKey } from '../data/bodies';
import { SolarSystemEngine } from '../engine/SolarSystemEngine';
import type { LayerKey, Telemetry } from '../engine/types';
import {
  matchesReducedMotion,
  usePrefersReducedMotion,
} from '../hooks/usePrefersReducedMotion';
import {
  SimulationActionsContext,
  SimulationStateContext,
  StageRefContext,
  type SimulationActions,
} from './contexts';
import { initialState, simulationReducer, speedFor } from './simulation';

const EMPTY_TELEMETRY: Telemetry = Object.freeze({
  elapsedYears: 0,
  hoveredKey: null,
  focusRange: null,
  satellitesVisible: 0,
  fps: 60,
  plot: [],
});

/**
 * Owns the engine and the UI state, and keeps the two in sync.
 *
 * The direction of data flow is strict:
 *
 *   user input → reducer → effect → engine method      (React drives config)
 *   engine     → telemetry store → useSyncExternalStore (engine drives readouts)
 *
 * Nothing per-frame ever enters React state.
 */
export function SimulationProvider({ children }: { children: ReactNode }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<SolarSystemEngine | null>(null);
  const [state, dispatch] = useReducer(simulationReducer, initialState);
  const prefersReducedMotion = usePrefersReducedMotion();

  // --- Engine lifecycle -----------------------------------------------------
  // Mount-only, and deliberately so: rebuilding the WebGL context on a state
  // change would be catastrophic. The AbortController makes the async build
  // cancellable, which StrictMode exercises on every dev mount.
  useEffect(() => {
    const container = stageRef.current;
    if (!container) return;

    const controller = new AbortController();
    let engine: SolarSystemEngine | null = null;

    try {
      engine = new SolarSystemEngine({
        container,
        // Read imperatively at effect time rather than mirroring the hook into
        // a ref; the sync effect below handles every later change.
        reducedMotion: matchesReducedMotion(),
        callbacks: {
          onSelect: (key) => dispatch({ type: 'select', key }),
          onProgress: (value, stage) => dispatch({ type: 'progress', value, stage }),
        },
      });
      engineRef.current = engine;

      void engine
        .build(controller.signal)
        .then(() => {
          if (!controller.signal.aborted) dispatch({ type: 'ready' });
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          dispatch({ type: 'error', message: describeFailure(error) });
        });
    } catch (error) {
      // Nearly always "WebGL unavailable" — surfaced as a real error state with
      // a retry path, never as a black screen.
      dispatch({ type: 'error', message: describeFailure(error) });
    }

    return () => {
      controller.abort();
      engine?.dispose();
      engineRef.current = null;
    };
  }, []);

  // --- Push UI state down into the engine -----------------------------------
  useEffect(() => {
    engineRef.current?.setPlaying(state.playing);
  }, [state.playing]);

  useEffect(() => {
    engineRef.current?.setSpeed(speedFor(state.speedIndex));
  }, [state.speedIndex]);

  useEffect(() => {
    engineRef.current?.focus(state.selectedKey);
  }, [state.selectedKey]);

  useEffect(() => {
    engineRef.current?.setLayers(state.layers);
  }, [state.layers]);

  useEffect(() => {
    engineRef.current?.setReducedMotion(prefersReducedMotion);
    document.documentElement.dataset.reducedMotion = String(prefersReducedMotion);
  }, [prefersReducedMotion]);

  // --- Stable action surface -------------------------------------------------
  const togglePlay = useCallback(() => dispatch({ type: 'togglePlay' }), []);

  const setSpeedIndex = useCallback(
    (index: number) => dispatch({ type: 'setSpeedIndex', value: index }),
    [],
  );

  const select = useCallback((key: BodyKey | null) => dispatch({ type: 'select', key }), []);

  const toggleLayer = useCallback(
    (layer: LayerKey) => dispatch({ type: 'toggleLayer', layer }),
    [],
  );

  const setQuery = useCallback((value: string) => dispatch({ type: 'setQuery', value }), []);

  const resetView = useCallback(() => {
    dispatch({ type: 'resetView' });
    engineRef.current?.resetView();
  }, []);

  const registerLabel = useCallback((key: BodyKey, element: HTMLElement | null) => {
    engineRef.current?.registerLabel(key, element);
  }, []);

  const subscribeTelemetry = useCallback(
    (listener: () => void) => engineRef.current?.subscribe(listener) ?? noop,
    [],
  );

  const getTelemetry = useCallback(
    () => engineRef.current?.getSnapshot() ?? EMPTY_TELEMETRY,
    [],
  );

  // Every member is a stable useCallback, so this object's identity never
  // changes after mount — which is the entire point of splitting the contexts.
  const actions = useMemo<SimulationActions>(
    () => ({
      togglePlay,
      setSpeedIndex,
      select,
      toggleLayer,
      setQuery,
      resetView,
      registerLabel,
      subscribeTelemetry,
      getTelemetry,
    }),
    [
      togglePlay,
      setSpeedIndex,
      select,
      toggleLayer,
      setQuery,
      resetView,
      registerLabel,
      subscribeTelemetry,
      getTelemetry,
    ],
  );

  return (
    <StageRefContext.Provider value={stageRef}>
      <SimulationActionsContext.Provider value={actions}>
        <SimulationStateContext.Provider value={state}>
          {children}
        </SimulationStateContext.Provider>
      </SimulationActionsContext.Provider>
    </StageRefContext.Provider>
  );
}

const noop = (): void => {};

const describeFailure = (error: unknown): string =>
  error instanceof Error ? error.message : 'WebGL could not be initialised on this device.';
