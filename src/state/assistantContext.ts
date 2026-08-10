import { createContext, useContext } from 'react';

import type { SpaceAssistant } from '../hooks/useSpaceAssistant';

/**
 * The assistant, shared.
 *
 * Both the desktop rail and the mobile sheet stay mounted at every viewport and
 * are switched with CSS — that is what keeps the breakpoint in one place and
 * avoids a resize listener. It also means any component rendered in both runs
 * its effects twice, which for this one would mean two introductions generated
 * and two voices speaking at once.
 *
 * So the conversation lives above both of them and the panel is a pure
 * consumer. Split from the provider file because the project's ESLint config
 * (react-refresh) requires modules to export components or values, not both —
 * the same reason `contexts.ts` sits beside `SimulationContext.tsx`.
 */
export const AssistantContext = createContext<SpaceAssistant | null>(null);

export function useAssistant(): SpaceAssistant {
  const value = useContext(AssistantContext);
  if (!value) throw new Error('useAssistant must be used inside <AssistantProvider>.');
  return value;
}
