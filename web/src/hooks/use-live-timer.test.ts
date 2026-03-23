import { act, renderHook } from '@testing-library/react'
import { useLiveTimer } from '@web/hooks/use-live-timer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('useLiveTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns zero state when startTime is null', () => {
    const { result } = renderHook(() => useLiveTimer(null, null))

    expect(result.current.elapsedSeconds).toBe(0)
    expect(result.current.formatted).toBe('00:00')
    expect(result.current.isOverEstimate).toBe(false)
  })

  it('calculates elapsed time from startTime', () => {
    const startTime = new Date(Date.now() - 65 * 1000).toISOString()
    const { result } = renderHook(() => useLiveTimer(startTime, null))

    expect(result.current.elapsedSeconds).toBe(65)
    expect(result.current.formatted).toBe('01:05')
    expect(result.current.isOverEstimate).toBe(false)
  })

  it('formats hours correctly', () => {
    const startTime = new Date(
      Date.now() - (1 * 3600 + 23 * 60 + 45) * 1000,
    ).toISOString()
    const { result } = renderHook(() => useLiveTimer(startTime, null))

    expect(result.current.formatted).toBe('1:23:45')
  })

  it('detects over-estimate', () => {
    const startTime = new Date(Date.now() - 35 * 60 * 1000).toISOString()
    const { result } = renderHook(() => useLiveTimer(startTime, 30))

    expect(result.current.isOverEstimate).toBe(true)
  })

  it('is not over-estimate when within time', () => {
    const startTime = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const { result } = renderHook(() => useLiveTimer(startTime, 30))

    expect(result.current.isOverEstimate).toBe(false)
  })

  it('updates every second', () => {
    const startTime = new Date(Date.now() - 10 * 1000).toISOString()
    const { result } = renderHook(() => useLiveTimer(startTime, null))

    expect(result.current.elapsedSeconds).toBe(10)

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(result.current.elapsedSeconds).toBe(13)
    expect(result.current.formatted).toBe('00:13')
  })

  it('does not start interval when startTime is null', () => {
    const { result } = renderHook(() => useLiveTimer(null, 30))

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(result.current.elapsedSeconds).toBe(0)
  })

  it('clamps negative elapsed time to zero', () => {
    // startTime in the future
    const startTime = new Date(Date.now() + 10000).toISOString()
    const { result } = renderHook(() => useLiveTimer(startTime, null))

    expect(result.current.elapsedSeconds).toBe(0)
  })
})
