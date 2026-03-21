import type { ContextFilterMode } from '@web/lib/context-filter'
import type { ReactNode } from 'react'
import { createContext, useContext, useState } from 'react'

export type { ContextFilterMode }

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
