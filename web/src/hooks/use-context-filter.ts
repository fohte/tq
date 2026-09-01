import { useNavigate, useSearch } from '@tanstack/react-router'

import type { ContextFilterMode } from '#lib/context-filter'
import { getStorageItem, setStorageItem } from '#lib/local-storage'

export type { ContextFilterMode }

export const STORAGE_KEY = 'tq:context-filter-mode'

interface ContextFilterState {
  mode: ContextFilterMode
  setMode: (mode: ContextFilterMode) => void
}

function isContextFilterMode(value: string | null): value is ContextFilterMode {
  return value === 'all' || value === 'work' || value === 'personal'
}

function readStoredMode(): ContextFilterMode | null {
  const raw = getStorageItem(STORAGE_KEY).unwrapOr(null)
  return isContextFilterMode(raw) ? raw : null
}

export function useContextFilter(): ContextFilterState {
  const { context } = useSearch({ strict: false })
  const navigate = useNavigate()

  return {
    // Falls back to localStorage (not just 'all') so a reload on a URL
    // without `context` (e.g. a bookmarked link) still shows the mode the
    // user last picked.
    mode: context ?? readStoredMode() ?? 'all',
    setMode: (mode) => {
      setStorageItem(STORAGE_KEY, mode).unwrapOr(undefined)
      void navigate({
        to: '.',
        search: (prev) => ({ ...prev, context: mode }),
        replace: true,
      })
    },
  }
}
