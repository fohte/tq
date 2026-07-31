import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DEBOUNCED_SAVE_DELAY_MS,
  useDebouncedSave,
} from '#hooks/use-debounced-save'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useDebouncedSave', () => {
  it('does not save until the debounce delay elapses', () => {
    const save = vi.fn()
    const { result } = renderHook(() => useDebouncedSave(save))

    act(() => {
      result.current.onChange('draft')
    })
    act(() => {
      vi.advanceTimersByTime(DEBOUNCED_SAVE_DELAY_MS - 1)
    })

    expect(save).not.toHaveBeenCalled()
  })

  it('saves the latest value once the debounce delay elapses', () => {
    const save = vi.fn()
    const { result } = renderHook(() => useDebouncedSave(save))

    act(() => {
      result.current.onChange('first')
    })
    act(() => {
      result.current.onChange('second')
    })
    act(() => {
      vi.advanceTimersByTime(DEBOUNCED_SAVE_DELAY_MS)
    })

    expect(save.mock.calls).toEqual([['second']])
  })

  it('flush saves a pending call immediately', () => {
    const save = vi.fn()
    const { result } = renderHook(() => useDebouncedSave(save))

    act(() => {
      result.current.onChange('draft')
    })
    act(() => {
      result.current.flush()
    })

    expect(save.mock.calls).toEqual([['draft']])
  })

  it('flush is a no-op when there is no pending call', () => {
    const save = vi.fn()
    const { result } = renderHook(() => useDebouncedSave(save))

    act(() => {
      result.current.flush()
    })

    expect(save).not.toHaveBeenCalled()
  })

  it('cancel drops a pending call without saving', () => {
    const save = vi.fn()
    const { result } = renderHook(() => useDebouncedSave(save))

    act(() => {
      result.current.onChange('draft')
    })
    act(() => {
      result.current.cancel()
    })
    act(() => {
      vi.advanceTimersByTime(DEBOUNCED_SAVE_DELAY_MS)
    })

    expect(save).not.toHaveBeenCalled()
  })

  it('flushes a pending call on unmount', () => {
    const save = vi.fn()
    const { result, unmount } = renderHook(() => useDebouncedSave(save))

    act(() => {
      result.current.onChange('draft')
    })
    unmount()

    expect(save.mock.calls).toEqual([['draft']])
  })

  it('does not save on unmount when there is no pending call', () => {
    const save = vi.fn()
    const { unmount } = renderHook(() => useDebouncedSave(save))

    unmount()

    expect(save).not.toHaveBeenCalled()
  })

  it('keeps using the save callback captured when onChange was called, even if a newer save is provided before the timer fires', () => {
    const fired: string[] = []
    const firstSave = () => {
      fired.push('first')
    }
    const secondSave = () => {
      fired.push('second')
    }
    const { result, rerender } = renderHook(
      ({ save }) => useDebouncedSave(save),
      { initialProps: { save: firstSave } },
    )

    act(() => {
      result.current.onChange('draft')
    })
    rerender({ save: secondSave })
    act(() => {
      vi.advanceTimersByTime(DEBOUNCED_SAVE_DELAY_MS)
    })

    expect(fired).toEqual(['first'])
  })

  it('uses the latest save callback for a call scheduled after a rerender', () => {
    const fired: string[] = []
    const firstSave = () => {
      fired.push('first')
    }
    const secondSave = () => {
      fired.push('second')
    }
    const { result, rerender } = renderHook(
      ({ save }) => useDebouncedSave(save),
      { initialProps: { save: firstSave } },
    )

    rerender({ save: secondSave })
    act(() => {
      result.current.onChange('draft')
    })
    act(() => {
      vi.advanceTimersByTime(DEBOUNCED_SAVE_DELAY_MS)
    })

    expect(fired).toEqual(['second'])
  })

  it('does not save before a custom delay elapses', () => {
    const save = vi.fn()
    const { result } = renderHook(() => useDebouncedSave(save, 300))

    act(() => {
      result.current.onChange('draft')
    })
    act(() => {
      vi.advanceTimersByTime(299)
    })

    expect(save).not.toHaveBeenCalled()
  })

  it('saves once a custom delay elapses', () => {
    const save = vi.fn()
    const { result } = renderHook(() => useDebouncedSave(save, 300))

    act(() => {
      result.current.onChange('draft')
    })
    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(save.mock.calls).toEqual([['draft']])
  })
})
