import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { Mock } from 'vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { makeTask } from '#components/task/task-row-test-fixtures'
import {
  TASK_LIST_PAGE_SIZE,
  useInfiniteTaskList,
} from '#hooks/use-task-queries'

vi.mock('#lib/api', () => {
  const mockGet = vi.fn()
  return {
    api: { api: { tasks: { $get: mockGet } } },
    __mocks: { mockGet },
  }
})

async function getMockGet() {
  const mod = await import('#lib/api')
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- accessing test-only __mocks property injected by vi.mock
  const typed = mod as unknown as { __mocks: { mockGet: Mock } }
  return typed.__mocks.mockGet
}

let queryClient: QueryClient

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

beforeEach(async () => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const mockGet = await getMockGet()
  mockGet.mockReset()
})

function jsonResponse(tasks: unknown[]) {
  return { ok: true, json: () => Promise.resolve(tasks) }
}

describe('useInfiniteTaskList', () => {
  it('marks hasNextPage false once a page returns fewer than a full page', async () => {
    const mockGet = await getMockGet()
    mockGet.mockResolvedValue(jsonResponse([makeTask({ id: 'a' })]))

    const { result } = renderHook(
      () => useInfiniteTaskList({ parentId: 'root' }),
      {
        wrapper,
      },
    )

    await waitFor(() => {
      expect(result.current.tasks).toEqual([makeTask({ id: 'a' })])
    })
    expect(result.current.hasNextPage).toBe(false)
    expect(mockGet).toHaveBeenCalledWith({
      query: {
        parentId: 'root',
        limit: String(TASK_LIST_PAGE_SIZE),
        offset: '0',
      },
    })
  })

  it('fetches the next page at an advanced offset and de-dupes tasks that appear on both pages', async () => {
    const mockGet = await getMockGet()
    const firstPage = Array.from({ length: TASK_LIST_PAGE_SIZE }, (_, i) =>
      makeTask({ id: `task-${String(i)}` }),
    )
    // Simulates a task shifting from page 2 into page 1 between fetches
    // (offset pagination isn't stable under concurrent inserts/deletes).
    const secondPage = [
      makeTask({ id: 'task-0' }),
      makeTask({ id: 'task-new' }),
    ]
    mockGet.mockImplementation(({ query }: { query: { offset: string } }) =>
      Promise.resolve(
        jsonResponse(query.offset === '0' ? firstPage : secondPage),
      ),
    )

    const { result } = renderHook(
      () => useInfiniteTaskList({ parentId: 'root' }),
      {
        wrapper,
      },
    )

    await waitFor(() => {
      expect(result.current.hasNextPage).toBe(true)
    })

    await result.current.fetchNextPage()

    // task-0 keeps its position from firstPage (Map preserves first-seen
    // order) but its value comes from secondPage's later fetch.
    const expectedTasks = [...firstPage, makeTask({ id: 'task-new' })]
    await waitFor(() => {
      expect(result.current.tasks).toEqual(expectedTasks)
    })
    expect(mockGet).toHaveBeenLastCalledWith({
      query: {
        parentId: 'root',
        limit: String(TASK_LIST_PAGE_SIZE),
        offset: String(TASK_LIST_PAGE_SIZE),
      },
    })
  })

  it('does not fetch while disabled', async () => {
    const mockGet = await getMockGet()
    mockGet.mockResolvedValue(jsonResponse([]))

    renderHook(
      () => useInfiniteTaskList({ parentId: 'root' }, { enabled: false }),
      { wrapper },
    )

    expect(mockGet).not.toHaveBeenCalled()
  })
})
