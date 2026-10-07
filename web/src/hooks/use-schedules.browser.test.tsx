import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { makeSchedule } from '#components/schedule/schedule-test-fixtures'
import { useScheduleList } from '#hooks/use-schedules'
import { assertDefined } from '#lib/test-utils'

vi.mock('#lib/api', () => {
  const mockGet = vi.fn()

  return {
    api: { api: { schedule: { recurring: { $get: mockGet } } } },
    __mocks: { mockGet },
  }
})

async function getMocks() {
  const mod = await import('#lib/api')
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- accessing test-only __mocks property injected by vi.mock
  const typed = mod as unknown as {
    __mocks: { mockGet: ReturnType<typeof vi.fn> }
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
    defaultOptions: { queries: { retry: false } },
  })
  const mocks = await getMocks()
  mocks.mockGet.mockReset()
})

afterEach(() => {
  queryClient.clear()
  vi.useRealTimers()
})

describe('useScheduleList', () => {
  it('does not fetch or poll when disabled', async () => {
    vi.useFakeTimers()
    const mocks = await getMocks()

    renderHook(() => useScheduleList('2026-03-22', '2026-03-22', false), {
      wrapper,
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })

    expect(assertDefined(mocks.mockGet).mock.calls).toEqual([])
  })

  it('does not poll schedules for external changes', async () => {
    vi.useFakeTimers()
    const mocks = await getMocks()
    const schedule = makeSchedule({
      scheduleId: 'schedule-1',
      title: 'Lunch',
      start: '2026-03-22T12:00:00',
      end: '2026-03-22T13:00:00',
    })
    assertDefined(mocks.mockGet).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([schedule]),
    })

    renderHook(() => useScheduleList('2026-03-22', '2026-03-22'), { wrapper })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    const initialCallCount = assertDefined(mocks.mockGet).mock.calls.length

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    const callCountAfterOneMinute = assertDefined(mocks.mockGet).mock.calls
      .length

    const getFetchCounts = () => [initialCallCount, callCountAfterOneMinute]
    expect(getFetchCounts()).toEqual([1, 1])
  })
})
