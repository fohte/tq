import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useGlobalKeybindings } from '#hooks/use-global-keybindings'
import { getSearchKeybinding } from '#lib/keybindings'

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

function searchShortcutOutcome(calls: unknown[], event: KeyboardEvent) {
  return { calls, defaultPrevented: event.defaultPrevented }
}

function setup(searchOpen = false) {
  const onSearchOpenChange = vi.fn()
  const onNewTask = vi.fn()
  const searchKeybinding = getSearchKeybinding(navigator.platform)
  renderHook(() => {
    useGlobalKeybindings({
      searchKeybinding,
      searchOpen,
      onSearchOpenChange,
      onNewTask,
    })
  })
  return { onSearchOpenChange, onNewTask }
}

function setPlatform(platform: string) {
  vi.stubGlobal(
    'navigator',
    Object.create(navigator, { platform: { value: platform } }),
  )
}

describe('useGlobalKeybindings', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  beforeEach(() => {
    navigateMock.mockClear()
    document.documentElement.removeAttribute('data-base-ui-scroll-locked')
  })

  it('toggles search open on Cmd+K on macOS', () => {
    setPlatform('MacIntel')
    const { onSearchOpenChange } = setup(false)

    const event = fireKey('k', { metaKey: true })

    expect(searchShortcutOutcome(onSearchOpenChange.mock.calls, event)).toEqual(
      { calls: [[true]], defaultPrevented: true },
    )
  })

  it('toggles search closed on Cmd+K on macOS when already open', () => {
    setPlatform('MacIntel')
    const { onSearchOpenChange } = setup(true)

    fireKey('k', { metaKey: true })

    expect(onSearchOpenChange.mock.calls).toEqual([[false]])
  })

  it('on macOS, Ctrl+K is left to the OS/browser', () => {
    setPlatform('MacIntel')
    const { onSearchOpenChange } = setup(false)

    const event = fireKey('k', { ctrlKey: true })

    expect(searchShortcutOutcome(onSearchOpenChange.mock.calls, event)).toEqual(
      { calls: [], defaultPrevented: false },
    )
  })

  it('leaves Ctrl+K to the OS/browser on macOS while typing in an input', () => {
    setPlatform('MacIntel')
    const input = document.createElement('input')
    document.body.appendChild(input)
    const { onSearchOpenChange } = setup(false)

    const event = fireKey('k', { ctrlKey: true }, input)

    expect(searchShortcutOutcome(onSearchOpenChange.mock.calls, event)).toEqual(
      { calls: [], defaultPrevented: false },
    )
    input.remove()
  })

  it.each(['Win32', 'Linux x86_64'])(
    'toggles search open on Ctrl+K on %s',
    (platform) => {
      setPlatform(platform)
      const { onSearchOpenChange } = setup(false)

      const event = fireKey('k', { ctrlKey: true })

      expect(
        searchShortcutOutcome(onSearchOpenChange.mock.calls, event),
      ).toEqual({ calls: [[true]], defaultPrevented: true })
    },
  )

  it('toggles search closed on Ctrl+K on Linux when already open', () => {
    setPlatform('Linux x86_64')
    const { onSearchOpenChange } = setup(true)

    const event = fireKey('k', { ctrlKey: true })

    expect(searchShortcutOutcome(onSearchOpenChange.mock.calls, event)).toEqual(
      { calls: [[false]], defaultPrevented: true },
    )
  })

  it('toggles search open on Ctrl+K on Linux while typing in an input', () => {
    setPlatform('Linux x86_64')
    const input = document.createElement('input')
    document.body.appendChild(input)
    const { onSearchOpenChange } = setup(false)

    const event = fireKey('k', { ctrlKey: true }, input)

    expect(searchShortcutOutcome(onSearchOpenChange.mock.calls, event)).toEqual(
      { calls: [[true]], defaultPrevented: true },
    )
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
    setPlatform('MacIntel')
    const input = document.createElement('input')
    document.body.appendChild(input)
    const { onSearchOpenChange } = setup(false)

    fireKey('k', { metaKey: true }, input)

    expect(onSearchOpenChange.mock.calls).toEqual([[true]])
    input.remove()
  })
})
