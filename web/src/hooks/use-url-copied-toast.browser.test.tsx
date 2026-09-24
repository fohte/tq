import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useUrlCopiedToast } from '#hooks/use-url-copied-toast'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useUrlCopiedToast', () => {
  it('shows the copied URL and hides it after 1.5 seconds', () => {
    const url = 'https://example.test/tasks/42'
    const { result } = renderHook(() => useUrlCopiedToast())
    const states: (string | null)[] = []

    act(() => {
      window.dispatchEvent(
        new CustomEvent('tq:url-copied', { detail: { url } }),
      )
    })
    states.push(result.current)

    act(() => {
      vi.advanceTimersByTime(1499)
    })
    states.push(result.current)

    act(() => {
      vi.advanceTimersByTime(1)
    })
    states.push(result.current)

    expect(states).toEqual([url, url, null])
  })

  it('restarts the timeout when another URL is copied', () => {
    const firstUrl = 'https://example.test/tasks/42'
    const secondUrl = 'https://example.test/tasks/43'
    const { result } = renderHook(() => useUrlCopiedToast())
    const states: (string | null)[] = []

    act(() => {
      window.dispatchEvent(
        new CustomEvent('tq:url-copied', { detail: { url: firstUrl } }),
      )
    })
    states.push(result.current)

    act(() => {
      vi.advanceTimersByTime(1000)
      window.dispatchEvent(
        new CustomEvent('tq:url-copied', { detail: { url: secondUrl } }),
      )
    })
    states.push(result.current)

    act(() => {
      vi.advanceTimersByTime(1499)
    })
    states.push(result.current)

    act(() => {
      vi.advanceTimersByTime(1)
    })
    states.push(result.current)

    expect(states).toEqual([firstUrl, secondUrl, secondUrl, null])
  })
})
