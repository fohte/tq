import type { ReactNode } from 'react'
import { createContext, useContext, useState } from 'react'

export type ContextFilterMode = 'all' | 'work' | 'personal'

interface ContextFilterState {
  mode: ContextFilterMode
  setMode: (mode: ContextFilterMode) => void
}

const ContextFilterContext = createContext<ContextFilterState | null>(null)

export function ContextFilterProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ContextFilterMode>('all')

  return (
    <ContextFilterContext.Provider value={{ mode, setMode }}>
      {children}
    </ContextFilterContext.Provider>
  )
}

export function useContextFilter(): ContextFilterState {
  const ctx = useContext(ContextFilterContext)
  if (!ctx) {
    throw new Error(
      'useContextFilter must be used within a ContextFilterProvider',
    )
  }
  return ctx
}

/**
 * Map filter mode to API context values.
 * - 'all' -> undefined (no filter)
 * - 'work' -> 'work'
 * - 'personal' -> undefined (filter client-side since personal includes 'personal' + 'dev')
 */
export function filterModeToApiContext(
  mode: ContextFilterMode,
): 'work' | undefined {
  switch (mode) {
    case 'work':
      return 'work'
    case 'all':
    case 'personal':
      return undefined
  }
}

/**
 * Client-side filter for tasks based on context mode.
 * Used for 'personal' mode which includes both 'personal' and 'dev' contexts.
 */
export function matchesContextFilter(
  taskContext: string,
  mode: ContextFilterMode,
): boolean {
  switch (mode) {
    case 'all':
      return true
    case 'work':
      return taskContext === 'work'
    case 'personal':
      return taskContext === 'personal' || taskContext === 'dev'
  }
}
