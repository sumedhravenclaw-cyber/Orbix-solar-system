import type { ReactNode } from 'react';

import { useSpaceAssistant } from '../hooks/useSpaceAssistant';
import { AssistantContext } from './assistantContext';

/**
 * Runs the assistant exactly once for the whole app.
 *
 * Must sit inside SimulationProvider: the conversation is driven by
 * `selectedKey`, which lives there.
 */
export function AssistantProvider({ children }: { children: ReactNode }) {
  const assistant = useSpaceAssistant();
  return <AssistantContext.Provider value={assistant}>{children}</AssistantContext.Provider>;
}
