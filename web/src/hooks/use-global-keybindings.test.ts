import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useGlobalKeybindings } from '#hooks/use-global-keybindings'

const navigateMock = vi.fn(() => Promise.resolve())

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}))

function fireKey(
  key: string,
  opts: KeyboardEventInit = {},
  target: EventTarget = document.body,
) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...opts,
  })
  target.dispatchEvent(event)
  return event
}

function setup(searchOpen = false) {
  const onSearchOpenChange = vi.fn()
  const onNewTask = vi.fn()
  renderHook(() => {
    useGlobalKeybindings({ searchOpen, onSearchOpenChange, onNewTask })
  })
  return { onSearchOpenChange, onNewTask }
}

describe('useGlobalKeybindings', () => {
  beforeEach(() => {
    navigateMock.mockClear()
    document.documentElement.removeAttribute('data-base-ui-scroll-locked')
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

  it('leaves Ctrl+K to the OS/browser instead of opening search', () => {
    const { onSearchOpenChange } = setup(false)

    const event = fireKey('k', { ctrlKey: true })

    expect(onSearchOpenChange).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it('leaves Ctrl+K to the OS/browser while typing in an input', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    const { onSearchOpenChange } = setup(false)

    const event = fireKey('k', { ctrlKey: true }, input)

    expect(onSearchOpenChange).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
    input.remove()
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

  it('calls onNewTask on n', () => {
    const { onNewTask } = setup()

    fireKey('n')

    expect(onNewTask).toHaveBeenCalledTimes(1)
  })

  it('ignores single-key shortcuts while typing in an input', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    const { onNewTask } = setup()

    fireKey('n', {}, input)

    expect(onNewTask).not.toHaveBeenCalled()
    input.remove()
  })

  it('ignores single-key shortcuts while a Base UI dialog is open', () => {
    document.documentElement.setAttribute('data-base-ui-scroll-locked', '')
    const { onNewTask } = setup()

    fireKey('n')

    expect(onNewTask).not.toHaveBeenCalled()
    document.documentElement.removeAttribute('data-base-ui-scroll-locked')
  })

  it('ignores single-key shortcuts while the search modal is open', () => {
    const { onNewTask } = setup(true)

    fireKey('n')

    expect(onNewTask).not.toHaveBeenCalled()
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
