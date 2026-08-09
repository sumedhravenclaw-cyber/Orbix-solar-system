import { BodyLabels } from './components/BodyLabels';
import { ErrorPanel } from './components/ErrorPanel';
import { SkipLink } from './components/SkipLink';
import { Viewport } from './components/Viewport';
import { BootScreen } from './components/hud/BootScreen';
import { ConsoleLayout } from './components/hud/ConsoleLayout';
import { TimeController } from './components/hud/TimeController';
import { MobileSheet } from './components/mobile/MobileSheet';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { SimulationProvider } from './state/SimulationContext';

/**
 * Console shell.
 *
 * Every child reads exactly the slice of state it needs, so a speed change
 * re-renders the rate readout and nothing else. DOM order is focus order:
 * skip link → scene → console rails → transport.
 */
function Shell() {
  useKeyboardShortcuts();

  return (
    <>
      <SkipLink />
      <Viewport />
      <BodyLabels />
      <ConsoleLayout />
      <MobileSheet />
      <TimeController />
      <BootScreen />
      <ErrorPanel />
    </>
  );
}

export default function App() {
  return (
    <SimulationProvider>
      <Shell />
    </SimulationProvider>
  );
}
