import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { makeTask } from '#components/task/task-row-test-fixtures'
import {
  allTasksFilter,
  type TaskListFilter,
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

function taskListQuerySnapshot(data: unknown, calls: unknown) {
  return { data, calls }
}

function taskListPlaceholderSnapshot(
  data: unknown,
  isPlaceholderData: boolean,
  previousFilter: TaskListFilter | undefined,
) {
  return { data, isPlaceholderData, previousFilter }
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
      () =>
        useInfiniteTaskList({
          view: 'full',
          context: 'all',
          status: 'all',
          parentId: 'root',
        }),
      {
        wrapper,
      },
    )

    await waitFor(() => {
      expect(result.current.tasks).toEqual([makeTask({ id: 'a' })])
    })
    expect(mockGet).toHaveBeenCalledWith({
      query: {
        view: 'full',
        context: 'all',
        parentId: 'root',
        status: 'all',
        limit: String(TASK_LIST_PAGE_SIZE),
        offset: '0',
      },
    })
  })

  it('marks hasNextPage false once a page returns fewer than a full page', async () => {
    mockGet.mockResolvedValue(jsonResponse([makeTask({ id: 'a' })]))

    const { result } = renderHook(
      () =>
        useInfiniteTaskList({
          view: 'full',
          context: 'all',
          status: 'all',
          parentId: 'root',
        }),
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
      () =>
        useInfiniteTaskList({
          view: 'full',
          context: 'all',
          status: 'all',
          parentId: 'root',
        }),
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
          view: 'full',
          context: 'all',
          parentId: 'root',
          status: 'all',
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
      () =>
        useInfiniteTaskList({
          view: 'full',
          context: 'all',
          status: 'all',
          parentId: 'root',
        }),
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
      () =>
        useInfiniteTaskList(
          {
            view: 'full',
            context: 'all',
            status: 'all',
            parentId: 'root',
          },
          { enabled: false },
        ),
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
      requests: [
        [
          {
            query: {
              view: 'row',
              context: 'all',
              status: 'all',
              limit: 'unlimited',
              descendantOf: 'root-task',
            },
          },
        ],
      ],
    })
  })

  it('serializes an ID-scoped list with its context and all statuses', async () => {
    mockGet.mockResolvedValue(jsonResponse([]))

    const { result } = renderHook(
      () =>
        useTaskList({
          view: 'full',
          ids: ['task-a', 'task-b'],
          context: 'work',
          status: ['todo', 'completed'],
          limit: 'unlimited',
        }),
      { wrapper },
    )

    await waitFor(() => {
      expect(
        taskListQuerySnapshot(result.current.data, mockGet.mock.calls),
      ).toEqual({
        data: [],
        calls: [
          [
            {
              query: {
                view: 'full',
                ids: ['task-a', 'task-b'],
                context: 'work',
                status: ['todo', 'completed'],
                limit: 'unlimited',
                hasDue: undefined,
                includeAncestors: undefined,
              },
            },
          ],
        ],
      })
    })
  })

  it('passes the previous list filter to placeholder data', async () => {
    const previousTask = makeTask({ id: 'previous' })
    let resolveCurrentQuery: ((tasks: unknown[]) => void) | undefined
    mockGet.mockImplementation(({ query }: { query: { ids: string[] } }) => {
      if (query.ids[0] === 'previous') {
        return Promise.resolve(jsonResponse([previousTask]))
      }
      return new Promise((resolve) => {
        resolveCurrentQuery = (tasks) => {
          resolve(jsonResponse(tasks))
        }
      })
    })
    let previousFilter: TaskListFilter<'full'> | undefined

    const { result, rerender } = renderHook(
      ({ ids }: { ids: string[] }) =>
        useTaskList(
          {
            ids,
            view: 'full',
            context: 'work',
            status: 'all',
            limit: 'unlimited',
          },
          {
            placeholderData: (previousData, filter) => {
              previousFilter = filter
              return previousData
            },
          },
        ),
      { wrapper, initialProps: { ids: ['previous'] } },
    )

    await waitFor(() => {
      if (!result.current.isSuccess) {
        throw new Error('the previous task query has not completed')
      }
    })
    rerender({ ids: ['current'] })
    await waitFor(() => {
      expect(
        taskListPlaceholderSnapshot(
          result.current.data,
          result.current.isPlaceholderData,
          previousFilter,
        ),
      ).toEqual({
        data: [previousTask],
        isPlaceholderData: true,
        previousFilter: {
          ids: ['previous'],
          view: 'full',
          context: 'work',
          status: 'all',
          limit: 'unlimited',
        },
      })
    })

    await act(async () => {
      resolveCurrentQuery?.([makeTask({ id: 'current' })])
      await Promise.resolve()
    })
  })

  it('does not request an empty ID filter while disabled', () => {
    renderHook(
      () =>
        useTaskList(
          {
            ids: [],
            view: 'full',
            context: 'work',
            status: 'all',
            limit: 'unlimited',
          },
          { enabled: false },
        ),
      { wrapper },
    )

    expect(mockGet.mock.calls).toEqual([])
  })

  it('serializes server-side day-view filters as an HTTP query string', async () => {
    mockGet.mockResolvedValue(jsonResponse([]))

    const { result } = renderHook(
      () =>
        useTaskList({
          view: 'full',
          ids: ['task-b', 'task-a'],
          context: 'work',
          includeAncestors: true,
          status: 'todo',
          dateFrom: '2032-05-11',
          dateTo: '2032-05-15',
          dueTo: '2032-05-13',
          candidatesOn: '2032-05-12',
          limit: 'unlimited',
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
            view: 'full',
            ids: ['task-b', 'task-a'],
            context: 'work',
            includeAncestors: 'true',
            status: 'todo',
            dateFrom: '2032-05-11',
            dateTo: '2032-05-15',
            dueTo: '2032-05-13',
            candidatesOn: '2032-05-12',
            limit: 'unlimited',
          },
        },
      ],
    ])
  })

  it('serializes the due-date filter as an HTTP query string', async () => {
    mockGet.mockResolvedValue(jsonResponse([]))

    const { result } = renderHook(
      () =>
        useTaskList({
          view: 'full',
          context: 'all',
          status: 'todo',
          limit: 'unlimited',
          hasDue: true,
          sortBy: 'due',
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
            view: 'full',
            context: 'all',
            status: 'todo',
            hasDue: 'true',
            sortBy: 'due',
            limit: 'unlimited',
          },
        },
      ],
    ])
  })

  it('requests task rows by default', async () => {
    mockGet.mockResolvedValue(jsonResponse([]))

    renderHook(() => useTaskList(allTasksFilter), { wrapper })

    await waitFor(() => {
      expect(mockGet.mock.calls).toEqual([
        [
          {
            query: {
              view: 'row',
              context: 'all',
              status: 'all',
              limit: 'unlimited',
            },
          },
        ],
      ])
    })
  })

  it('does not poll task lists', async () => {
    vi.useFakeTimers()
    try {
      mockGet.mockResolvedValue(jsonResponse([]))

      renderHook(() => useTaskList(allTasksFilter), { wrapper })

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
