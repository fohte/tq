import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  LIVE_TODAY_CHECK_INTERVAL_MS,
  useLiveToday,
} from '#hooks/use-live-today'
import { formatLocalDate } from '#lib/date-range'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useLiveToday', () => {
  it('returns the current local date on mount', () => {
    vi.setSystemTime(new Date(2026, 6, 31, 12, 0, 0))
    const { result } = renderHook(() => useLiveToday())

    expect(formatLocalDate(result.current)).toBe('2026-07-31')
  })

  it('advances once the local date rolls over', () => {
    vi.setSystemTime(new Date(2026, 6, 31, 23, 59, 0))
    const { result } = renderHook(() => useLiveToday())

    act(() => {
      vi.advanceTimersByTime(LIVE_TODAY_CHECK_INTERVAL_MS)
    })

    expect(formatLocalDate(result.current)).toBe('2026-08-01')
  })

  it('does not update while it is still the same local day', () => {
    vi.setSystemTime(new Date(2026, 6, 31, 12, 0, 0))
    const { result } = renderHook(() => useLiveToday())
    const initial = result.current

    act(() => {
      vi.advanceTimersByTime(LIVE_TODAY_CHECK_INTERVAL_MS)
    })

    expect(result.current).toBe(initial)
  })
})
