import { useNavigate, useSearch } from '@tanstack/react-router'

import type { ContextFilterMode } from '#lib/context-filter'

export type { ContextFilterMode }

interface ContextFilterState {
  mode: ContextFilterMode
  setMode: (mode: ContextFilterMode) => void
}

export function useContextFilter(): ContextFilterState {
  const { context } = useSearch({ strict: false })
  // `from: '/'` only pins the *type* used for the search updater below (this
  // hook is called from many routes) — navigate() with no `to` always stays
  // on the current URL and only touches search at runtime.
  const navigate = useNavigate({ from: '/' })

  return {
    mode: context ?? 'all',
    setMode: (mode) => {
      void navigate({
        search: (prev) => ({ ...prev, context: mode }),
        replace: true,
      })
    },
  }
}
