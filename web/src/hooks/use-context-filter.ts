import { useNavigate, useSearch } from '@tanstack/react-router'
import { useState } from 'react'

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
  const [storedMode, setStoredMode] = useState(readStoredMode)

  return {
    mode: context ?? storedMode ?? 'all',
    setMode: (mode) => {
      setStorageItem(STORAGE_KEY, mode).unwrapOr(undefined)
      setStoredMode(mode)
      void navigate({
        to: '.',
        search: (prev) => ({ ...prev, context: mode }),
        replace: true,
      })
    },
  }
}
