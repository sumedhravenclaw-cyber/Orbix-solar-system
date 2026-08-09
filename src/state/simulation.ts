import type { BodyKey } from '../data/bodies';
import type { LayerKey, LayerState } from '../engine/types';

/**
 * Console UI state.
 *
 * Deliberately small: this holds only what the *interface* needs to render.
 * Positions, angles and elapsed time live in the engine and arrive as throttled
 * telemetry — putting them here would re-render the tree at 60fps.
 */

export type Phase = 'booting' | 'ready' | 'error';

export interface SimulationState {
  readonly phase: Phase;
  /** Build progress, 0 → 1, and the stage label the boot screen shows. */
  readonly progress: number;
  readonly stage: string;
  readonly playing: boolean;
  /** Index into SPEED_STEPS. */
  readonly speedIndex: number;
  readonly selectedKey: BodyKey | null;
  readonly layers: LayerState;
  /** Catalogue filter text. */
  readonly query: string;
  readonly errorMessage: string | null;
}

/**
 * Discrete speed steps rather than a continuous slider.
 *
 * Every arrow-key press then produces a meaningful, announceable change, and
 * 1× is always exactly 1× — a continuous log slider can only approach it.
 */
export const SPEED_STEPS = [0.1, 0.25, 0.5, 1, 2, 5, 10, 25, 60] as const;
export const DEFAULT_SPEED_INDEX = 3; // → 1×

export const initialState: SimulationState = {
  phase: 'booting',
  progress: 0,
  stage: 'Initialising',
  playing: true,
  speedIndex: DEFAULT_SPEED_INDEX,
  selectedKey: null,
  layers: {
    orbits: true,
    labels: true,
    satellites: true,
    belt: true,
    atmospheres: true,
  },
  query: '',
  errorMessage: null,
};

export type SimulationAction =
  | { type: 'progress'; value: number; stage: string }
  | { type: 'ready' }
  | { type: 'error'; message: string }
  | { type: 'togglePlay' }
  | { type: 'setSpeedIndex'; value: number }
  | { type: 'select'; key: BodyKey | null }
  | { type: 'toggleLayer'; layer: LayerKey }
  | { type: 'setQuery'; value: string }
  | { type: 'resetView' };

const clampIndex = (value: number): number =>
  Math.min(SPEED_STEPS.length - 1, Math.max(0, Math.round(value)));

export function simulationReducer(
  state: SimulationState,
  action: SimulationAction,
): SimulationState {
  switch (action.type) {
    case 'progress':
      return {
        ...state,
        progress: Math.min(1, Math.max(0, action.value)),
        stage: action.stage,
      };

    case 'ready':
      return state.phase === 'ready'
        ? state
        : { ...state, phase: 'ready', progress: 1, stage: 'Orbital plane locked' };

    case 'error':
      return { ...state, phase: 'error', errorMessage: action.message };

    case 'togglePlay':
      return { ...state, playing: !state.playing };

    case 'setSpeedIndex': {
      const speedIndex = clampIndex(action.value);
      return speedIndex === state.speedIndex ? state : { ...state, speedIndex };
    }

    case 'select':
      return state.selectedKey === action.key ? state : { ...state, selectedKey: action.key };

    case 'toggleLayer':
      return {
        ...state,
        layers: { ...state.layers, [action.layer]: !state.layers[action.layer] },
      };

    case 'setQuery':
      return state.query === action.value ? state : { ...state, query: action.value };

    case 'resetView':
      return state.selectedKey === null ? state : { ...state, selectedKey: null };

    default:
      return state;
  }
}

export const speedFor = (index: number): number => SPEED_STEPS[clampIndex(index)];

export const LAYER_LABELS: Record<LayerKey, string> = {
  orbits: 'Orbit traces',
  labels: 'Body labels',
  satellites: 'Satellites',
  belt: 'Asteroid belt',
  atmospheres: 'Atmospheres',
};
