import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useFilteredTaskTree } from '#hooks/use-filtered-tasks'

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }))

vi.mock('#lib/api', () => ({
  api: { api: { tasks: { $get: mockGet } } },
}))

vi.mock('#hooks/use-current-context', () => ({
  useCurrentContext: () => 'work',
}))

let queryClient: QueryClient

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  mockGet.mockReset()
})

describe('useFilteredTaskTree', () => {
  it('does not fetch either task list when disabled', async () => {
    renderHook(
      () =>
        useFilteredTaskTree({
          q: 'is:todo sort:updated',
          projectId: 'project-a',
          enabled: false,
        }),
      { wrapper },
    )

    await act(async () => {
      await Promise.resolve()
    })

    expect(mockGet.mock.calls).toEqual([])
  })

  it('reports errors from paginated and free-text task queries', async () => {
    mockGet.mockRejectedValue(new Error('request failed'))
    const { result } = renderHook(
      () => ({
        root: useFilteredTaskTree({ q: 'is:todo sort:updated' }),
        search: useFilteredTaskTree({ q: 'sample is:todo sort:updated' }),
      }),
      { wrapper },
    )

    const getErrorSnapshot = () => ({
      root: result.current.root.isError,
      search: result.current.search.isError,
    })
    await waitFor(() => {
      expect(getErrorSnapshot()).toEqual({ root: true, search: true })
    })
  })
})
