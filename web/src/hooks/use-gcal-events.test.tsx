import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import {
  GcalAuthRequiredError,
  useAutoRescheduleOnGcalChange,
  useGcalAuthUrl,
  useGcalEvents,
} from '@web/hooks/use-gcal-events'
import { getDayIsoRange } from '@web/lib/date-range'
import { assertDefined } from '@web/lib/test-utils'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@web/lib/api', () => {
  const mockEventsGet = vi.fn()
  const mockAuthUrlGet = vi.fn()

  return {
    api: {
      api: {
        calendar: {
          events: { $get: mockEventsGet },
          'auth-url': { $get: mockAuthUrlGet },
        },
      },
    },
    __mocks: { mockEventsGet, mockAuthUrlGet },
  }
})

async function getMocks() {
  const mod = await import('@web/lib/api')
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- accessing test-only __mocks property injected by vi.mock
  const typed = mod as unknown as {
    __mocks: Record<string, ReturnType<typeof vi.fn>>
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
  for (const mock of Object.values(mocks)) {
    mock.mockReset()
  }
})

const sampleEvent = {
  id: 'gcal-event-1',
  summary: 'Team Standup',
  startTime: '2026-07-07T10:00:00.000Z',
  endTime: '2026-07-07T10:30:00.000Z',
  isAllDay: false,
  source: 'google_calendar' as const,
}

describe('useGcalEvents', () => {
  it('returns the fetched events on success', async () => {
    const mocks = await getMocks()
    assertDefined(mocks['mockEventsGet']).mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.resolve([sampleEvent]),
    })

    const { result } = renderHook(() => useGcalEvents('2026-07-07'), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data).toEqual([sampleEvent])
  })

  it('queries the given date range for the primary calendar', async () => {
    const mocks = await getMocks()
    assertDefined(mocks['mockEventsGet']).mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.resolve([sampleEvent]),
    })

    const { result } = renderHook(() => useGcalEvents('2026-07-07'), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(assertDefined(mocks['mockEventsGet']).mock.calls).toEqual([
      [{ query: { calendarId: 'primary', ...getDayIsoRange('2026-07-07') } }],
    ])
  })

  it('throws GcalAuthRequiredError on 401', async () => {
    const mocks = await getMocks()
    assertDefined(mocks['mockEventsGet']).mockResolvedValue({
      status: 401,
      ok: false,
      json: () => Promise.resolve({ error: 'No OAuth token found' }),
    })

    const { result } = renderHook(() => useGcalEvents('2026-07-07'), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(result.current.error).toBeInstanceOf(GcalAuthRequiredError)
  })

  it('polls for external calendar changes while mounted', async () => {
    vi.useFakeTimers()
    try {
      const mocks = await getMocks()
      assertDefined(mocks['mockEventsGet']).mockResolvedValue({
        status: 200,
        ok: true,
        json: () => Promise.resolve([sampleEvent]),
      })

      renderHook(() => useGcalEvents('2026-07-07'), { wrapper })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(assertDefined(mocks['mockEventsGet']).mock.calls.length).toBe(1)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000)
      })
      expect(assertDefined(mocks['mockEventsGet']).mock.calls.length).toBe(2)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('useAutoRescheduleOnGcalChange', () => {
  it('does not call onChange on the first render', () => {
    const onChange = vi.fn()
    renderHook(
      ({ events }) => {
        useAutoRescheduleOnGcalChange(events, onChange)
      },
      { initialProps: { events: [sampleEvent] } },
    )

    expect(onChange).not.toHaveBeenCalled()
  })

  it('calls onChange when the events change to a new value', () => {
    const onChange = vi.fn()
    const { rerender } = renderHook(
      ({ events }) => {
        useAutoRescheduleOnGcalChange(events, onChange)
      },
      { initialProps: { events: [sampleEvent] } },
    )

    rerender({
      events: [sampleEvent, { ...sampleEvent, id: 'gcal-event-2' }],
    })

    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('does not call onChange when rerendered with the same reference', () => {
    const onChange = vi.fn()
    const events = [sampleEvent]
    const { rerender } = renderHook(
      ({ events }) => {
        useAutoRescheduleOnGcalChange(events, onChange)
      },
      { initialProps: { events } },
    )

    rerender({ events })

    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not call onChange while events is still undefined', () => {
    const onChange = vi.fn()
    const { rerender } = renderHook(
      ({ events }: { events: (typeof sampleEvent)[] | undefined }) => {
        useAutoRescheduleOnGcalChange(events, onChange)
      },
      { initialProps: { events: undefined } },
    )

    rerender({ events: undefined })

    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not call onChange when the initial query load resolves', () => {
    const onChange = vi.fn()
    const { rerender } = renderHook(
      ({ events }: { events: (typeof sampleEvent)[] | undefined }) => {
        useAutoRescheduleOnGcalChange(events, onChange)
      },
      {
        initialProps: {
          events: undefined as (typeof sampleEvent)[] | undefined,
        },
      },
    )

    // The query finishes loading and returns data for the first time
    rerender({ events: [sampleEvent] })

    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('useGcalAuthUrl', () => {
  it('fetches the auth URL when enabled', async () => {
    const mocks = await getMocks()
    assertDefined(mocks['mockAuthUrlGet']).mockResolvedValue({
      status: 200,
      ok: true,
      json: () =>
        Promise.resolve({
          url: 'https://accounts.google.com/o/oauth2/v2/auth',
        }),
    })

    const { result } = renderHook(() => useGcalAuthUrl(true), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data).toEqual({
      url: 'https://accounts.google.com/o/oauth2/v2/auth',
    })
  })

  it('does not fetch when disabled', async () => {
    const mocks = await getMocks()

    renderHook(() => useGcalAuthUrl(false), { wrapper })

    expect(assertDefined(mocks['mockAuthUrlGet'])).not.toHaveBeenCalled()
  })
})
