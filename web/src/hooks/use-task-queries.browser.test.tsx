import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { makeTask } from '#components/task/task-row-test-fixtures'
import {
  useInfiniteTaskList,
  useSelfAndDescendantIds,
  useTaskCount,
  useTaskList,
} from '#hooks/use-task-queries'

const TASK_LIST_PAGE_SIZE = 50

const { mockGet, mockCount } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockCount: vi.fn(),
}))

vi.mock('#lib/api', () => ({
  api: { api: { tasks: { $get: mockGet, count: { $get: mockCount } } } },
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
  mockCount.mockReset()
})

function jsonResponse(tasks: unknown[]) {
  return { ok: true, json: () => Promise.resolve(tasks) }
}

function taskCountQuerySnapshot(
  counts: unknown,
  countCalls: unknown,
  listCalls: unknown,
) {
  return { counts, countCalls, listCalls }
}

function descendantIdSnapshot(
  initialCallCount: number,
  ids: string[],
  requests: unknown[],
) {
  return { initialCallCount, ids, requests }
}

function useTaskCountConsumers() {
  const inbox = useTaskCount({
    context: 'work',
    commitment: 'inbox',
    status: 'todo',
  })
  const todos = useTaskCount({ context: 'work', status: 'todo' })
  return { inbox, todos }
}

describe('useInfiniteTaskList', () => {
  it('queries the first page with limit/offset', async () => {
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
    expect(mockGet).toHaveBeenCalledWith({
      query: {
        parentId: 'root',
        limit: String(TASK_LIST_PAGE_SIZE),
        offset: '0',
      },
    })
  })

  it('marks hasNextPage false once a page returns fewer than a full page', async () => {
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
  })

  it('advances the offset on fetchNextPage', async () => {
    const firstPage = Array.from({ length: TASK_LIST_PAGE_SIZE }, (_, i) =>
      makeTask({ id: `task-${String(i)}` }),
    )
    mockGet.mockResolvedValue(jsonResponse(firstPage))

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

    await waitFor(() => {
      expect(mockGet).toHaveBeenLastCalledWith({
        query: {
          parentId: 'root',
          limit: String(TASK_LIST_PAGE_SIZE),
          offset: String(TASK_LIST_PAGE_SIZE),
        },
      })
    })
  })

  it('de-dupes tasks that appear on both pages', async () => {
    const firstPage = Array.from({ length: TASK_LIST_PAGE_SIZE }, (_, i) =>
      makeTask({ id: `task-${String(i)}` }),
    )
    // Simulates a task shifting from page 2 into page 1 between fetches
    // (offset pagination isn't stable under concurrent inserts/deletes).
    // task-0's title differs from firstPage's so the assertion below can
    // tell which page's copy won the de-dupe.
    const secondPage = [
      makeTask({ id: 'task-0', title: 'task-0 refetched' }),
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
    const expectedTasks = [
      makeTask({ id: 'task-0', title: 'task-0 refetched' }),
      ...firstPage.slice(1),
      makeTask({ id: 'task-new' }),
    ]
    await waitFor(() => {
      expect(result.current.tasks).toEqual(expectedTasks)
    })
  })

  it('does not fetch while disabled', () => {
    mockGet.mockResolvedValue(jsonResponse([]))

    renderHook(
      () => useInfiniteTaskList({ parentId: 'root' }, { enabled: false }),
      { wrapper },
    )

    expect(mockGet).not.toHaveBeenCalled()
  })
})

describe('useTaskList', () => {
  it('queries descendant IDs only when enabled and includes the task itself', async () => {
    const descendantTasks = [
      makeTask({ id: 'child-task' }),
      makeTask({ id: 'grandchild-task' }),
    ]
    mockGet.mockResolvedValue(jsonResponse(descendantTasks))
    const { result, rerender } = renderHook(
      ({ enabled }) => useSelfAndDescendantIds('root-task', enabled),
      { initialProps: { enabled: false }, wrapper },
    )
    const initialCallCount = mockGet.mock.calls.length

    rerender({ enabled: true })
    await waitFor(() => {
      if (!result.current.has('grandchild-task')) {
        throw new Error('Descendant IDs have not loaded')
      }
    })

    expect(
      descendantIdSnapshot(
        initialCallCount,
        [...result.current],
        mockGet.mock.calls,
      ),
    ).toEqual({
      initialCallCount: 0,
      ids: ['root-task', 'child-task', 'grandchild-task'],
      requests: [[{ query: { descendantOf: 'root-task' } }]],
    })
  })

  it('serializes task-list filters including descendants as an HTTP query string', async () => {
    mockGet.mockResolvedValue(jsonResponse([]))

    const { result } = renderHook(
      () =>
        useTaskList({
          status: 'todo',
          hasDue: true,
          sortBy: 'due',
          descendantOf: 'ancestor-id',
        }),
      { wrapper },
    )

    await waitFor(() => {
      expect(result.current.data).toEqual([])
    })

    expect(mockGet.mock.calls).toEqual([
      [
        {
          query: {
            status: 'todo',
            hasDue: 'true',
            sortBy: 'due',
            descendantOf: 'ancestor-id',
          },
        },
      ],
    ])
  })

  it('does not poll task lists', async () => {
    vi.useFakeTimers()
    try {
      mockGet.mockResolvedValue(jsonResponse([]))

      renderHook(() => useTaskList(undefined), { wrapper })

      let initialCallCount = 0
      const getCallCounts = () => ({
        initial: initialCallCount,
        afterOneMinute: mockGet.mock.calls.length,
      })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      initialCallCount = mockGet.mock.calls.length

      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000)
      })

      expect(getCallCounts()).toEqual({ initial: 1, afterOneMinute: 1 })
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('useTaskCount', () => {
  it('keeps filtered counts separate without fetching task rows', async () => {
    mockCount.mockImplementation(
      ({ query }: { query: { commitment?: string } }) =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ count: query.commitment == null ? 9 : 4 }),
        }),
    )

    const { result } = renderHook(useTaskCountConsumers, { wrapper })

    await waitFor(() => {
      expect(
        taskCountQuerySnapshot(
          {
            inbox: result.current.inbox.data,
            todos: result.current.todos.data,
          },
          mockCount.mock.calls,
          mockGet.mock.calls,
        ),
      ).toEqual({
        counts: { inbox: 4, todos: 9 },
        countCalls: [
          [
            {
              query: {
                context: 'work',
                commitment: 'inbox',
                status: 'todo',
              },
            },
          ],
          [
            {
              query: {
                context: 'work',
                status: 'todo',
              },
            },
          ],
        ],
        listCalls: [],
      })
    })
  })
})
