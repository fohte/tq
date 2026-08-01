import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useGlobalKeybindings } from '#hooks/use-global-keybindings'
import { useNewTaskShortcutListener } from '#hooks/use-new-task-shortcut'

const navigateMock = vi.fn(() => Promise.resolve())

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}))

function fireKey(
  key: string,
  opts: KeyboardEventInit = {},
  target: EventTarget = document.body,
) {
  target.dispatchEvent(
    new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
      ...opts,
    }),
  )
}

function setup(searchOpen = false) {
  const onSearchOpenChange = vi.fn()
  renderHook(() => {
    useGlobalKeybindings({ searchOpen, onSearchOpenChange })
  })
  return { onSearchOpenChange }
}

describe('useGlobalKeybindings', () => {
  beforeEach(() => {
    navigateMock.mockClear()
    document.documentElement.removeAttribute('data-base-ui-scroll-locked')
  })

  // A prior test's `n` press may have dispatched the new-task shortcut without
  // any listener mounted to consume it (see use-new-task-shortcut.ts's pending
  // flag); drain it so later tests don't see a stale trigger on mount.
  afterEach(() => {
    const { unmount } = renderHook(() => {
      useNewTaskShortcutListener(() => {})
    })
    unmount()
  })

  it('toggles search open on Cmd+K', () => {
    const { onSearchOpenChange } = setup(false)

    fireKey('k', { metaKey: true })

    expect(onSearchOpenChange).toHaveBeenCalledWith(true)
  })

  it('toggles search closed on Cmd+K when already open', () => {
    const { onSearchOpenChange } = setup(true)

    fireKey('k', { metaKey: true })

    expect(onSearchOpenChange).toHaveBeenCalledWith(false)
  })

  it('toggles search open on Ctrl+K', () => {
    const { onSearchOpenChange } = setup(false)

    fireKey('k', { ctrlKey: true })

    expect(onSearchOpenChange).toHaveBeenCalledWith(true)
  })

  it('navigates to the matching route on a g-prefixed chord', () => {
    setup()

    fireKey('g')
    fireKey('t')

    expect(navigateMock).toHaveBeenCalledWith({ to: '/tasks' })
  })

  it('drops the chord silently when the second key has no route', () => {
    setup()

    fireKey('g')
    fireKey('z')

    expect(navigateMock).not.toHaveBeenCalled()
  })

  describe('chord timeout', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('drops the chord once the timeout elapses', () => {
      setup()

      fireKey('g')
      vi.advanceTimersByTime(1001)
      fireKey('t')

      expect(navigateMock).not.toHaveBeenCalled()
    })
  })

  it('navigates to /tasks on n', () => {
    setup()

    fireKey('n')

    expect(navigateMock).toHaveBeenCalledWith({ to: '/tasks' })
  })

  it('dispatches the new-task shortcut once navigation resolves on n', async () => {
    const onTrigger = vi.fn()
    renderHook(() => {
      useNewTaskShortcutListener(onTrigger)
    })
    setup()

    fireKey('n')
    await Promise.resolve()

    expect(onTrigger).toHaveBeenCalledTimes(1)
  })

  it('ignores single-key shortcuts while typing in an input', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    setup()

    fireKey('n', {}, input)

    expect(navigateMock).not.toHaveBeenCalled()
    input.remove()
  })

  it('ignores single-key shortcuts while a Base UI dialog is open', () => {
    document.documentElement.setAttribute('data-base-ui-scroll-locked', '')
    setup()

    fireKey('n')

    expect(navigateMock).not.toHaveBeenCalled()
    document.documentElement.removeAttribute('data-base-ui-scroll-locked')
  })

  it('ignores single-key shortcuts while the search modal is open', () => {
    setup(true)

    fireKey('n')

    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('still handles Cmd+K while typing in an input', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    const { onSearchOpenChange } = setup(false)

    fireKey('k', { metaKey: true }, input)

    expect(onSearchOpenChange).toHaveBeenCalledWith(true)
    input.remove()
  })
})
