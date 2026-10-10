import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useSearchTasks } from '#hooks/use-search'

const { mockGetTasks } = vi.hoisted(() => ({ mockGetTasks: vi.fn() }))

vi.mock('#lib/api', () => ({
  api: { api: { tasks: { $get: mockGetTasks } } },
}))

let queryClient: QueryClient

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  mockGetTasks.mockReset()
  mockGetTasks.mockResolvedValue(
    new Response('[]', {
      headers: { 'Content-Type': 'application/json' },
    }),
  )
})

afterEach(() => {
  queryClient.clear()
  vi.useRealTimers()
})

describe('useSearchTasks', () => {
  it('requests full task rows with match snippets for free-text queries', async () => {
    renderHook(() => useSearchTasks('needle'), { wrapper })

    await waitFor(() => {
      expect(mockGetTasks.mock.calls).toEqual([
        [
          {
            query: {
              view: 'row',
              q: 'needle',
              limit: '20',
              context: 'all',
              status: 'all',
              includeMatch: 'true',
            },
          },
        ],
      ])
    })
  })
})
