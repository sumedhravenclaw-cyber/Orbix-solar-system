import { useEffect } from 'react';

import { useSimulationActions, useSimulationState } from '../state/contexts';

/**
 * Global keyboard shortcuts.
 *
 * Everything reachable by mouse is reachable by keyboard, and these are the
 * accelerators on top:
 *
 *   Space  hold / resume propagation
 *   Escape release the target, then (pressed again) return to the overview
 *   ← / →  step the rate multiplier
 *   /      jump to the catalogue filter
 *
 * Keystrokes are ignored while focus is inside a form control so the slider's
 * own arrow-key handling is never hijacked — except Escape, which must always
 * be able to get you out.
 */
export function useKeyboardShortcuts(): void {
  const { togglePlay, select, resetView, setSpeedIndex } = useSimulationActions();
  const { selectedKey, speedIndex } = useSimulationState();

  useEffect(() => {
    const isFormField = (target: EventTarget | null): boolean =>
      target instanceof HTMLElement &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable);

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      // Escape works everywhere, including from inside the search field, where
      // it clears focus rather than the target.
      if (event.key === 'Escape' && isFormField(event.target)) {
        (event.target as HTMLElement).blur();
        return;
      }

      if (isFormField(event.target)) return;

      switch (event.key) {
        case ' ':
        case 'Spacebar':
          event.preventDefault(); // otherwise the page tries to scroll
          togglePlay();
          break;

        case 'Escape':
          if (selectedKey) select(null);
          else resetView();
          break;

        case 'ArrowLeft':
          event.preventDefault();
          setSpeedIndex(speedIndex - 1);
          break;

        case 'ArrowRight':
          event.preventDefault();
          setSpeedIndex(speedIndex + 1);
          break;

        case '/': {
          // The console convention: slash focuses search.
          const search = document.querySelector<HTMLInputElement>('input[type="search"]');
          if (search) {
            event.preventDefault();
            search.focus();
            search.select();
          }
          break;
        }

        default:
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [togglePlay, select, resetView, setSpeedIndex, selectedKey, speedIndex]);
}
