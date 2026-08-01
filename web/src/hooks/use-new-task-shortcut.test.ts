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
})
