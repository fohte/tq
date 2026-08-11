import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'

import { useTagFilter, useTagToggle } from '#hooks/use-tag-filter'

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

describe('useTagFilter', () => {
  it('defaults to null (no filter)', async () => {
    const wrapper = await buildWrapper()
    const { result } = renderHook(() => useTagFilter(), { wrapper })
    expect(result.current.tag).toBeNull()
  })

  it('updates tag', async () => {
    const wrapper = await buildWrapper()
    const { result } = renderHook(() => useTagFilter(), { wrapper })
    act(() => {
      result.current.setTag('urgent')
    })
    await waitFor(() => {
      expect(result.current.tag).toBe('urgent')
    })
  })
})

describe('useTagToggle', () => {
  it('is inactive when no tag is selected', async () => {
    const wrapper = await buildWrapper()
    const { result } = renderHook(() => useTagToggle('urgent'), { wrapper })
    expect(result.current.isActive).toBe(false)
  })

  it('becomes active when toggled on', async () => {
    const wrapper = await buildWrapper()
    const { result } = renderHook(() => useTagToggle('urgent'), { wrapper })
    act(() => {
      result.current.toggle()
    })
    await waitFor(() => {
      expect(result.current.isActive).toBe(true)
    })
  })

  it('becomes inactive when toggled again', async () => {
    const wrapper = await buildWrapper()
    const { result } = renderHook(() => useTagToggle('urgent'), { wrapper })
    act(() => {
      result.current.toggle()
    })
    await waitFor(() => {
      expect(result.current.isActive).toBe(true)
    })
    act(() => {
      result.current.toggle()
    })
    await waitFor(() => {
      expect(result.current.isActive).toBe(false)
    })
  })

  it('is inactive when a different tag is selected', async () => {
    function useCombined() {
      return { filter: useTagFilter(), toggle: useTagToggle('urgent') }
    }
    const wrapper = await buildWrapper()
    const { result } = renderHook(() => useCombined(), { wrapper })
    act(() => {
      result.current.filter.setTag('other')
    })
    await waitFor(() => {
      expect(result.current.toggle.isActive).toBe(false)
    })
  })
})
