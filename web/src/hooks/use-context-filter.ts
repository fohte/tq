import { useNavigate, useSearch } from '@tanstack/react-router'

import type { ContextFilterMode } from '#lib/context-filter'

export type { ContextFilterMode }

interface ContextFilterState {
  mode: ContextFilterMode
  setMode: (mode: ContextFilterMode) => void
}

export function useContextFilter(): ContextFilterState {
  const { context } = useSearch({ strict: false })
  const navigate = useNavigate()

  return {
    mode: context ?? 'all',
    setMode: (mode) => {
      void navigate({
        to: '.',
        search: (prev) => ({ ...prev, context: mode }),
        replace: true,
      })
    },
  }
}
