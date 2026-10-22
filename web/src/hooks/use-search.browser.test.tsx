import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { makeTaskDetail } from '#components/task/task-row-test-fixtures'
import { useSearchTaskByIdOrNumber, useSearchTasks } from '#hooks/use-search'

const { mockGetTasks, mockGetTaskById } = vi.hoisted(() => ({
  mockGetTasks: vi.fn(),
  mockGetTaskById: vi.fn(),
}))

vi.mock('#lib/api', () => ({
  api: {
    api: {
      tasks: { $get: mockGetTasks, ':id': { $get: mockGetTaskById } },
    },
  },
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

describe('useSearchTaskByIdOrNumber', () => {
  it('requests the task identified by a task URL', async () => {
    const taskId = '00000000-0000-4000-8000-000000000011'
    mockGetTaskById.mockResolvedValue(
      new Response(JSON.stringify(makeTaskDetail({ id: taskId })), {
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    renderHook(
      () =>
        useSearchTaskByIdOrNumber(`https://${location.host}/tasks/${taskId}`),
      { wrapper },
    )

    await waitFor(() => {
      expect(mockGetTaskById.mock.calls).toEqual([[{ param: { id: taskId } }]])
    })
  })
})
