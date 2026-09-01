import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'

import { STORAGE_KEY, useContextFilter } from '#hooks/use-context-filter'
import {
  filterModeToApiContext,
  matchesContextFilter,
} from '#lib/context-filter'

beforeEach(() => {
  localStorage.clear()
})

// The router's first route match resolves asynchronously even with no
// loaders, so router.load() is awaited before renderHook() to avoid an
// initial render with no matched route (see
// https://tanstack.com/router/latest/docs/framework/react/guide/testing).
// `latestChildren` lets the pre-loaded root route's component render
// whatever renderHook's internal test harness passes as children.
async function buildWrapper() {
  let latestChildren: ReactNode = null
  const rootRoute = createRootRoute({
    validateSearch: (search: Record<string, unknown>) => search,
    component: () => <>{latestChildren}</>,
  })
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()

  return function wrapper({ children }: { children: ReactNode }) {
    latestChildren = children
    return <RouterProvider router={router} />
  }
}

describe('useContextFilter', () => {
  it('defaults to "all" mode', async () => {
    const wrapper = await buildWrapper()
    const { result } = renderHook(() => useContextFilter(), { wrapper })
    expect(result.current.mode).toBe('all')
  })

  it('updates mode', async () => {
    const wrapper = await buildWrapper()
    const { result } = renderHook(() => useContextFilter(), { wrapper })
    act(() => {
      result.current.setMode('work')
    })
    await waitFor(() => {
      expect(result.current.mode).toBe('work')
    })
  })

  it('reflects the same navigated state across multiple hook instances', async () => {
    function useCombined() {
      return { a: useContextFilter(), b: useContextFilter() }
    }
    const wrapper = await buildWrapper()
    const { result } = renderHook(() => useCombined(), { wrapper })
    act(() => {
      result.current.a.setMode('personal')
    })
    await waitFor(() => {
      expect(result.current.b.mode).toBe('personal')
    })
  })

  it('falls back to a stored mode when the URL has no context param', async () => {
    localStorage.setItem(STORAGE_KEY, 'work')
    const wrapper = await buildWrapper()
    const { result } = renderHook(() => useContextFilter(), { wrapper })
    expect(result.current.mode).toBe('work')
  })

  it('falls back to "all" when the stored value is not a recognized mode', async () => {
    localStorage.setItem(STORAGE_KEY, 'not-a-mode')
    const wrapper = await buildWrapper()
    const { result } = renderHook(() => useContextFilter(), { wrapper })
    expect(result.current.mode).toBe('all')
  })

  it('persists the mode so a newly mounted instance reads it back', async () => {
    const wrapper = await buildWrapper()
    const { result } = renderHook(() => useContextFilter(), { wrapper })
    act(() => {
      result.current.setMode('personal')
    })
    await waitFor(() => {
      expect(localStorage.getItem(STORAGE_KEY)).toBe('personal')
    })

    const freshWrapper = await buildWrapper()
    const { result: reloaded } = renderHook(() => useContextFilter(), {
      wrapper: freshWrapper,
    })
    expect(reloaded.current.mode).toBe('personal')
  })
})

describe('filterModeToApiContext', () => {
  it('returns undefined for "all"', () => {
    expect(filterModeToApiContext('all')).toBeUndefined()
  })

  it('returns "work" for "work"', () => {
    expect(filterModeToApiContext('work')).toBe('work')
  })

  it('returns "personal" for "personal"', () => {
    expect(filterModeToApiContext('personal')).toBe('personal')
  })
})

describe('matchesContextFilter', () => {
  it('"all" mode matches everything', () => {
    expect(matchesContextFilter('work', 'all')).toBe(true)
    expect(matchesContextFilter('personal', 'all')).toBe(true)
  })

  it('"work" mode matches only work', () => {
    expect(matchesContextFilter('work', 'work')).toBe(true)
    expect(matchesContextFilter('personal', 'work')).toBe(false)
  })

  it('"personal" mode matches only personal', () => {
    expect(matchesContextFilter('personal', 'personal')).toBe(true)
    expect(matchesContextFilter('work', 'personal')).toBe(false)
  })
})
