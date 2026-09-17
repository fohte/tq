import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { Mock } from 'vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { makeQueueItem } from '#components/task/queue-item-test-fixtures'
import { DAY_QUEUE_KEY, useTaskPlan, WEEK_QUEUE_KEY } from '#hooks/use-queues'
import { assertDefined } from '#lib/test-utils'

vi.mock('#lib/api', () => {
  const mockGet = vi.fn()
  const mockPut = vi.fn()
  return {
    api: {
      api: {
        queues: {
          ':key': {
            items: { $get: mockGet, $put: mockPut },
          },
        },
      },
    },
    __mocks: { mockGet, mockPut },
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
