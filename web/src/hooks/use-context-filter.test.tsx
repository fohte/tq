import { act, renderHook } from '@testing-library/react'
import {
  ContextFilterProvider,
  useContextFilter,
} from '@web/hooks/use-context-filter'
import {
  filterModeToApiContext,
  matchesContextFilter,
} from '@web/lib/context-filter'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'

function wrapper({ children }: { children: ReactNode }) {
  return <ContextFilterProvider>{children}</ContextFilterProvider>
}

describe('useContextFilter', () => {
  it('defaults to "all" mode', () => {
    const { result } = renderHook(() => useContextFilter(), { wrapper })
    expect(result.current.mode).toBe('all')
  })

  it('updates mode', () => {
    const { result } = renderHook(() => useContextFilter(), { wrapper })
    act(() => result.current.setMode('work'))
    expect(result.current.mode).toBe('work')
  })

  it('throws when used outside provider', () => {
    expect(() => {
      renderHook(() => useContextFilter())
    }).toThrow('useContextFilter must be used within a ContextFilterProvider')
  })
})

describe('filterModeToApiContext', () => {
  it('returns undefined for "all"', () => {
    expect(filterModeToApiContext('all')).toBeUndefined()
  })

  it('returns "work" for "work"', () => {
    expect(filterModeToApiContext('work')).toBe('work')
  })

  it('returns undefined for "personal" (client-side filtering)', () => {
    expect(filterModeToApiContext('personal')).toBeUndefined()
  })
})

describe('matchesContextFilter', () => {
  it('"all" mode matches everything', () => {
    expect(matchesContextFilter('work', 'all')).toBe(true)
    expect(matchesContextFilter('personal', 'all')).toBe(true)
    expect(matchesContextFilter('dev', 'all')).toBe(true)
  })

  it('"work" mode matches only work', () => {
    expect(matchesContextFilter('work', 'work')).toBe(true)
    expect(matchesContextFilter('personal', 'work')).toBe(false)
    expect(matchesContextFilter('dev', 'work')).toBe(false)
  })

  it('"personal" mode matches personal and dev', () => {
    expect(matchesContextFilter('personal', 'personal')).toBe(true)
    expect(matchesContextFilter('dev', 'personal')).toBe(true)
    expect(matchesContextFilter('work', 'personal')).toBe(false)
  })
})
