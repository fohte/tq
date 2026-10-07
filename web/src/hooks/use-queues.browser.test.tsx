import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { Mock } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { makeQueueItem } from '#components/task/queue-item-test-fixtures'
import { makeTask } from '#components/task/task-row-test-fixtures'
import { makeQueue } from '#hooks/queue-test-fixtures'
import {
  DAY_QUEUE_KEY,
  type Queue,
  useQueueCarryOver,
  useQueueItems,
  useQueueItemsForDates,
  useQueueItemsForQueues,
  useQueues,
  useSetQueueItems,
  useTaskPlan,
  WEEK_QUEUE_KEY,
} from '#hooks/use-queues'
import { useUpdateTask } from '#hooks/use-task-mutations'
import { formatLocalDate } from '#lib/date-range'
import { assertDefined } from '#lib/test-utils'

vi.mock('#lib/api', () => {
  const mockCarryOver = vi.fn()
  const mockQueueGet = vi.fn()
  const mockGet = vi.fn()
  const mockPut = vi.fn()
  const mockTaskPatch = vi.fn()
  return {
    api: {
      api: {
        queues: {
          $get: mockQueueGet,
          'carry-over': { $post: mockCarryOver },
          ':key': {
            items: { $get: mockGet, $put: mockPut },
          },
        },
        tasks: { ':id': { $patch: mockTaskPatch } },
      },
    },
    __mocks: { mockCarryOver, mockQueueGet, mockGet, mockPut, mockTaskPatch },
  }
})

async function getMocks() {
  const mod = await import('#lib/api')
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- accessing test-only __mocks property injected by vi.mock
  const typed = mod as unknown as {
    __mocks: Record<string, Mock>
  }
  return typed.__mocks
}

let queryClient: QueryClient

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

beforeEach(async () => {
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  const mocks = await getMocks()
  for (const mock of Object.values(mocks)) {
    mock.mockReset()
  }
})

afterEach(() => {
  vi.restoreAllMocks()
})

function queueItemsQuerySnapshot(data: unknown, calls: unknown) {
  return { data, calls }
}

const taskId = '00000000-0000-0000-0000-000000000001'
const earlierTaskId = '00000000-0000-0000-0000-000000000002'
const laterTaskId = '00000000-0000-0000-0000-000000000003'
const date = '2026-08-01'

function jsonResponse(body: unknown) {
  return { ok: true, json: () => Promise.resolve(body) }
}

function dayFetchCount(mockGet: Mock) {
  return mockGet.mock.calls.filter((call) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- vi.fn() call args are untyped; this mock is only ever invoked with the $get signature
    const [{ param }] = call as [{ param: { key: string } }]
    return param.key === DAY_QUEUE_KEY
  }).length
}

describe('useTaskPlan', () => {
  it('invalidates the previous queue after switching from today to this week', async () => {
    const mockGet = assertDefined((await getMocks())['mockGet'])
    const mockPut = assertDefined((await getMocks())['mockPut'])
    mockGet.mockImplementation(({ param }: { param: { key: string } }) =>
      Promise.resolve(
        jsonResponse(
          param.key === DAY_QUEUE_KEY ? [makeQueueItem({ taskId })] : [],
        ),
      ),
    )
    mockPut.mockImplementation(({ json }: { json: { taskIds: string[] } }) =>
      Promise.resolve(
        jsonResponse(json.taskIds.map((id) => makeQueueItem({ taskId: id }))),
      ),
    )

    const { result } = renderHook(() => useTaskPlan(taskId, date), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.plan).toBe('day')
    })
    const dayFetchesBeforeSwitch = dayFetchCount(mockGet)

    act(() => {
      result.current.setPlan('week')
    })

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith({
        param: { key: WEEK_QUEUE_KEY },
        json: { date, taskIds: [taskId] },
      })
    })

    await waitFor(() => {
      expect(dayFetchCount(mockGet)).toBeGreaterThan(dayFetchesBeforeSwitch)
    })
  })
})

describe('queue ordering cache', () => {
  it('requests queue items for the selected task context', async () => {
    const mockGet = assertDefined((await getMocks())['mockGet'])
    mockGet.mockResolvedValue(jsonResponse([]))

    const { result } = renderHook(
      () => useQueueItems(DAY_QUEUE_KEY, date, { context: 'work' }),
      { wrapper },
    )

    await waitFor(() => {
      expect(
        queueItemsQuerySnapshot(result.current.data, mockGet.mock.calls),
      ).toEqual({
        data: [],
        calls: [
          [
            {
              param: { key: DAY_QUEUE_KEY },
              query: { date, context: 'work' },
            },
          ],
        ],
      })
    })
  })

  it('refetches server order after replacing queue items', async () => {
    const mocks = await getMocks()
    const mockGet = assertDefined(mocks['mockGet'])
    const mockPut = assertDefined(mocks['mockPut'])
    const requestOrder = [
      makeQueueItem({ id: 'queue-item-later', taskId: laterTaskId }),
      makeQueueItem({ id: 'queue-item-earlier', taskId: earlierTaskId }),
    ]
    const dueOrder = [...requestOrder].reverse()
    mockGet
      .mockResolvedValueOnce(jsonResponse(requestOrder))
      .mockResolvedValueOnce(jsonResponse(dueOrder))
    mockPut.mockResolvedValue(jsonResponse(requestOrder))

    const { result: queue } = renderHook(
      () => useQueueItems(DAY_QUEUE_KEY, date),
      { wrapper },
    )
    await waitFor(() => {
      expect(queue.current.data).toEqual(requestOrder)
    })
    const { result: setQueueItems } = renderHook(() => useSetQueueItems(), {
      wrapper,
    })

    act(() => {
      setQueueItems.current.mutate({
        key: DAY_QUEUE_KEY,
        date,
        taskIds: [laterTaskId, earlierTaskId],
      })
    })

    await waitFor(() => {
      expect(queue.current.data).toEqual(dueOrder)
    })
  })

  it('refreshes queue order after a task due date changes', async () => {
    const mocks = await getMocks()
    const mockGet = assertDefined(mocks['mockGet'])
    const mockTaskPatch = assertDefined(mocks['mockTaskPatch'])
    const previousOrder = [
      makeQueueItem({ id: 'queue-item-later', taskId: taskId }),
      makeQueueItem({ id: 'queue-item-earlier', taskId: earlierTaskId }),
    ]
    const dueOrder = [...previousOrder].reverse()
    mockGet
      .mockResolvedValueOnce(jsonResponse(previousOrder))
      .mockResolvedValueOnce(jsonResponse(dueOrder))
    mockTaskPatch.mockResolvedValue(
      jsonResponse(makeTask({ id: taskId, dueDate: '2026-08-03' })),
    )

    const { result: queue } = renderHook(
      () => useQueueItems(DAY_QUEUE_KEY, date),
      { wrapper },
    )
    await waitFor(() => {
      expect(queue.current.data).toEqual(previousOrder)
    })
    const { result: updateTask } = renderHook(() => useUpdateTask(), {
      wrapper,
    })

    act(() => {
      updateTask.current.mutate({
        id: taskId,
        input: { dueDate: '2026-08-03' },
      })
    })

    await waitFor(() => {
      expect(queue.current.data).toEqual(dueOrder)
    })
  })
})

describe('queue polling', () => {
  it('refreshes queue definitions and items when an interval is configured', async () => {
    vi.useFakeTimers()
    try {
      const mocks = await getMocks()
      const queueGet = assertDefined(mocks['mockQueueGet'])
      const itemGet = assertDefined(mocks['mockGet'])
      const queues = [
        makeQueue({ key: DAY_QUEUE_KEY, name: 'today' }),
      ] satisfies Queue[]
      queueGet.mockResolvedValue(jsonResponse(queues))
      itemGet.mockResolvedValue(jsonResponse([]))

      renderHook(() => useQueues(60_000), { wrapper })
      renderHook(() => useQueueItemsForQueues(queues, date, 60_000), {
        wrapper,
      })

      let initialCallCounts = { queues: 0, items: 0 }
      const getCallCounts = () => ({
        initial: initialCallCounts,
        afterInterval: {
          queues: queueGet.mock.calls.length,
          items: itemGet.mock.calls.length,
        },
      })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      initialCallCounts = {
        queues: queueGet.mock.calls.length,
        items: itemGet.mock.calls.length,
      }

      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000)
      })

      expect(getCallCounts()).toEqual({
        initial: { queues: 1, items: 1 },
        afterInterval: { queues: 2, items: 2 },
      })
    } finally {
      vi.useRealTimers()
    }
  })
})
describe('queue carry-over', () => {
  it('reads today queue items if carry-over fails', async () => {
    const mocks = await getMocks()
    const mockCarryOver = assertDefined(mocks['mockCarryOver'])
    const mockGet = assertDefined(mocks['mockGet'])
    const today = formatLocalDate(new Date())
    const queues = [
      makeQueue({ key: DAY_QUEUE_KEY, name: 'today' }),
    ] satisfies Queue[]
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockCarryOver.mockResolvedValue(new Response(null, { status: 500 }))
    mockGet.mockResolvedValue(jsonResponse([]))

    const { result } = renderHook(
      () => {
        const carryOver = useQueueCarryOver(today)
        const items = useQueueItemsForQueues(queues, today, undefined, {
          enabled: carryOver.canReadQueueItems,
        })
        return { carryOver, items }
      },
      { wrapper },
    )

    await waitFor(() => {
      const getOutput = () => ({
        canReadQueueItems: result.current.carryOver.canReadQueueItems,
        carryOverFailed: result.current.carryOver.isError,
        queueReads: mockGet.mock.calls,
      })
      expect(getOutput()).toEqual({
        canReadQueueItems: true,
        carryOverFailed: true,
        queueReads: [
          [{ param: { key: DAY_QUEUE_KEY }, query: { date: today } }],
        ],
      })
    })
  })

  it('finishes carrying over today before reading its queue items', async () => {
    const mocks = await getMocks()
    const mockCarryOver = assertDefined(mocks['mockCarryOver'])
    const mockGet = assertDefined(mocks['mockGet'])
    const calls: string[] = []
    let resolveCarryOver: (() => void) | undefined
    const today = formatLocalDate(new Date())
    const queues = [
      makeQueue({ key: DAY_QUEUE_KEY, name: 'today' }),
    ] satisfies Queue[]
    mockCarryOver.mockImplementation(() => {
      calls.push('carry-over')
      return new Promise<Response>((resolve) => {
        resolveCarryOver = () => {
          resolve(new Response(null, { status: 204 }))
        }
      })
    })
    mockGet.mockImplementation(() => {
      calls.push('items')
      return Promise.resolve(jsonResponse([]))
    })

    const { result } = renderHook(
      () => {
        const carryOver = useQueueCarryOver(today)
        const items = useQueueItemsForQueues(queues, today, undefined, {
          enabled: carryOver.canReadQueueItems,
        })
        return { carryOver, items }
      },
      { wrapper },
    )

    await waitFor(() => {
      const getOutput = () => [
        calls,
        result.current.carryOver.isPending,
        mockCarryOver.mock.calls,
      ]
      expect(getOutput()).toEqual([
        ['carry-over'],
        true,
        [[{ json: { date: today } }]],
      ])
    })

    act(() => {
      assertDefined(resolveCarryOver)()
    })

    await waitFor(() => {
      const getOutput = () => [
        calls,
        result.current.carryOver.isSuccess,
        result.current.items[0]?.data,
      ]
      expect(getOutput()).toEqual([['carry-over', 'items'], true, []])
    })
  })
})

describe('queue items by date', () => {
  it('fetches each requested date under its own queue query key', async () => {
    const mockGet = assertDefined((await getMocks())['mockGet'])
    const dates = ['2026-08-03', '2026-08-04']
    const itemsByDate = [
      [makeQueueItem({ id: 'queue-item-first', taskId })],
      [makeQueueItem({ id: 'queue-item-second', taskId: earlierTaskId })],
    ]
    mockGet.mockImplementation(({ query }: { query: { date: string } }) =>
      Promise.resolve(
        jsonResponse(itemsByDate[dates.indexOf(query.date)] ?? []),
      ),
    )

    const { result } = renderHook(
      () => useQueueItemsForDates(DAY_QUEUE_KEY, dates),
      { wrapper },
    )

    await waitFor(() => {
      expect(result.current.map((query) => query.data)).toEqual(itemsByDate)
    })
    expect(
      mockGet.mock.calls.map((call) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- vi.fn() call args are the queue item GET signature
        const [{ param, query }] = call as [
          { param: { key: string }; query: { date: string } },
        ]
        return { key: param.key, date: query.date }
      }),
    ).toEqual([
      { key: DAY_QUEUE_KEY, date: dates[0] },
      { key: DAY_QUEUE_KEY, date: dates[1] },
    ])
  })
})
