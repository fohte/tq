import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  dispatchNewTaskShortcut,
  useNewTaskShortcutListener,
} from '#hooks/use-new-task-shortcut'

describe('useNewTaskShortcutListener', () => {
  it('invokes the listener when the shortcut event is dispatched', () => {
    const onTrigger = vi.fn()
    renderHook(() => {
      useNewTaskShortcutListener(onTrigger)
    })

    dispatchNewTaskShortcut()

    expect(onTrigger).toHaveBeenCalledTimes(1)
  })

  it('stops invoking the listener after unmount', () => {
    const onTrigger = vi.fn()
    const { unmount } = renderHook(() => {
      useNewTaskShortcutListener(onTrigger)
    })
    unmount()

    dispatchNewTaskShortcut()

    expect(onTrigger).not.toHaveBeenCalled()
  })

  it('delivers a dispatch that happened before any listener mounted', () => {
    dispatchNewTaskShortcut()

    const onTrigger = vi.fn()
    renderHook(() => {
      useNewTaskShortcutListener(onTrigger)
    })

    expect(onTrigger).toHaveBeenCalledTimes(1)
  })

  it('does not replay an already-consumed dispatch on a later mount', () => {
    dispatchNewTaskShortcut()
    const firstOnTrigger = vi.fn()
    const { unmount } = renderHook(() => {
      useNewTaskShortcutListener(firstOnTrigger)
    })
    unmount()

    const secondOnTrigger = vi.fn()
    renderHook(() => {
      useNewTaskShortcutListener(secondOnTrigger)
    })

    expect(secondOnTrigger).not.toHaveBeenCalled()
  })
})
