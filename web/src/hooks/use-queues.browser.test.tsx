import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { Mock } from 'vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { makeQueueItem } from '#components/task/queue-item-test-fixtures'
import { makeTask } from '#components/task/task-row-test-fixtures'
import {
  DAY_QUEUE_KEY,
  type Queue,
  useQueueItems,
  useQueueItemsForQueues,
  useQueues,
  useSetQueueItems,
  useTaskPlan,
  WEEK_QUEUE_KEY,
} from '#hooks/use-queues'
import { useUpdateTask } from '#hooks/use-task-mutations'
import { assertDefined } from '#lib/test-utils'

vi.mock('#lib/api', () => {
  const mockQueueGet = vi.fn()
  const mockGet = vi.fn()
  const mockPut = vi.fn()
  const mockTaskPatch = vi.fn()
  return {
    api: {
      api: {
        queues: {
          $get: mockQueueGet,
          ':key': {
            items: { $get: mockGet, $put: mockPut },
          },
        },
        tasks: { ':id': { $patch: mockTaskPatch } },
      },
    },
    __mocks: { mockQueueGet, mockGet, mockPut, mockTaskPatch },
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
        {
          key: DAY_QUEUE_KEY,
          name: 'today',
          periodUnit: 'day',
          position: 0,
        },
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
