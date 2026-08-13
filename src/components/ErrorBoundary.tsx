import { Component, type ErrorInfo, type ReactNode } from 'react';

import styles from './ErrorBoundary.module.css';

/**
 * Last line of defence.
 *
 * `ErrorPanel` covers the failure this app actually expects — WebGL refusing to
 * start — because that one is *reported* through simulation state. It cannot
 * catch a component that throws while rendering: React unmounts the whole tree
 * for that, and the user is left looking at the page background with no clue
 * and no way back. This boundary turns that into the same recoverable panel.
 *
 * A class is not a style choice here. Error boundaries have no hook equivalent;
 * `getDerivedStateFromError` is the only API React exposes for this.
 *
 * Deliberately not a retry-in-place: re-rendering the subtree would rebuild the
 * WebGL context on top of one that may be half torn down. A reload is the only
 * honest way to get back to a known-good state.
 */
interface ErrorBoundaryState {
  readonly error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // No telemetry endpoint in this project, so the console is the only sink.
    // Kept as `error` so it survives a production log filter, and the component
    // stack is included because the message alone rarely identifies the source.
    console.error('[orbix] render failed', error, info.componentStack);
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className={styles.overlay} role="alert">
        <div className={styles.panel}>
          <h2 className={styles.title}>Something went wrong</h2>

          <p className={styles.message}>
            The console hit an unexpected error and stopped. This is a fault in ORBIX SOL,
            not in your browser or your device.
          </p>

          <p className={styles.detail}>{error.message}</p>

          <button
            type="button"
            className={styles.action}
            onClick={() => window.location.reload()}
          >
            Reload console
          </button>
        </div>
      </div>
    );
  }
}
