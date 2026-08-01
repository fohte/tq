import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useSelectedDate } from '#hooks/use-selected-date'
import { formatLocalDate } from '#lib/date-range'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useSelectedDate', () => {
  it('starts on today', () => {
    vi.setSystemTime(new Date(2026, 6, 31, 12, 0, 0))
    const { result } = renderHook(() => useSelectedDate())

    expect(formatLocalDate(result.current.selectedDate)).toBe('2026-07-31')
  })

  it('pins to the date passed to setSelectedDate', () => {
    vi.setSystemTime(new Date(2026, 6, 31, 12, 0, 0))
    const { result } = renderHook(() => useSelectedDate())

    act(() => {
      result.current.setSelectedDate(new Date(2026, 6, 30))
    })

    expect(formatLocalDate(result.current.selectedDate)).toBe('2026-07-30')
  })

  it('stays pinned to the navigated date when the real date rolls over', () => {
    vi.setSystemTime(new Date(2026, 6, 31, 23, 59, 0))
    const { result } = renderHook(() => useSelectedDate())

    act(() => {
      result.current.setSelectedDate(new Date(2026, 6, 30))
    })
    act(() => {
      vi.advanceTimersByTime(60_000)
    })

    expect(formatLocalDate(result.current.selectedDate)).toBe('2026-07-30')
  })

  it('resumes following the live date once navigated back to today', () => {
    vi.setSystemTime(new Date(2026, 6, 31, 23, 59, 0))
    const { result } = renderHook(() => useSelectedDate())

    act(() => {
      result.current.setSelectedDate(new Date(2026, 6, 30))
    })
    act(() => {
      result.current.setSelectedDate(new Date(2026, 6, 31))
    })
    act(() => {
      vi.advanceTimersByTime(60_000)
    })

    expect(formatLocalDate(result.current.selectedDate)).toBe('2026-08-01')
  })
})
