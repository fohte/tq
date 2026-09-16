import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useOnAppForeground } from '#hooks/use-on-app-foreground'

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {
    value: state,
    configurable: true,
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('useOnAppForeground', () => {
  it('runs the callback once on mount', () => {
    const callback = vi.fn()

    renderHook(() => {
      useOnAppForeground(callback)
    })

    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('runs the callback again when the page becomes visible', () => {
    const callback = vi.fn()
    renderHook(() => {
      useOnAppForeground(callback)
    })

    setVisibility('visible')

    expect(callback).toHaveBeenCalledTimes(2)
  })

  it('does not run the callback when the page becomes hidden', () => {
    const callback = vi.fn()
    renderHook(() => {
      useOnAppForeground(callback)
    })

    setVisibility('hidden')

    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('calls the latest callback across re-renders instead of a stale one', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = renderHook(
      ({ callback }: { callback: () => void }) => {
        useOnAppForeground(callback)
      },
      { initialProps: { callback: first } },
    )

    rerender({ callback: second })
    setVisibility('visible')

    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('removes the listener on unmount', () => {
    const callback = vi.fn()
    const { unmount } = renderHook(() => {
      useOnAppForeground(callback)
    })

    unmount()
    setVisibility('visible')

    expect(callback).toHaveBeenCalledTimes(1)
  })
})
