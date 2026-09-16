import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useCalendarKeybindings } from '#hooks/use-calendar-keybindings'

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

function setup() {
  const onToday = vi.fn()
  const onPrev = vi.fn()
  const onNext = vi.fn()
  const onViewChange = vi.fn()
  renderHook(() => {
    useCalendarKeybindings({ onToday, onPrev, onNext, onViewChange })
  })
  return { onToday, onPrev, onNext, onViewChange }
}

describe('useCalendarKeybindings', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-base-ui-scroll-locked')
  })

  it('calls onToday on t', () => {
    const { onToday } = setup()

    fireKey('t')

    expect(onToday).toHaveBeenCalledTimes(1)
  })

  it('calls onPrev on ArrowLeft', () => {
    const { onPrev } = setup()

    fireKey('ArrowLeft')

    expect(onPrev).toHaveBeenCalledTimes(1)
  })

  it('calls onNext on ArrowRight', () => {
    const { onNext } = setup()

    fireKey('ArrowRight')

    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['d', 'day'],
    ['w', 'week'],
    ['m', 'month'],
  ] as const)('calls onViewChange with %s on %s', (key, view) => {
    const { onViewChange } = setup()

    fireKey(key)

    expect(onViewChange).toHaveBeenCalledExactlyOnceWith(view)
  })

  it('ignores shortcuts while typing in an input', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    const { onToday } = setup()

    fireKey('t', {}, input)

    expect(onToday).not.toHaveBeenCalled()
    input.remove()
  })

  it('ignores shortcuts while a Base UI dialog is open', () => {
    document.documentElement.setAttribute('data-base-ui-scroll-locked', '')
    const { onToday } = setup()

    fireKey('t')

    expect(onToday).not.toHaveBeenCalled()
  })

  it('ignores shortcuts held with a modifier key', () => {
    const { onToday } = setup()

    const event = fireKey('t', { metaKey: true })

    expect(onToday).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it('ignores repeated keydown events from a held key', () => {
    const { onNext } = setup()

    fireKey('ArrowRight', { repeat: true })

    expect(onNext).not.toHaveBeenCalled()
  })

  it('treats Caps Lock-cased letters the same as lowercase', () => {
    const { onToday } = setup()

    fireKey('T')

    expect(onToday).toHaveBeenCalledTimes(1)
  })

  describe('chord suppression', () => {
    // useGlobalKeybindings resolves 'g d' / 'g t' as nav chords; this hook's
    // bare 'd'/'t' shortcuts must not also fire for that same second
    // keystroke (see use-global-keybindings.ts's navByChord).
    it('does not fire onViewChange for the "d" following a "g"', () => {
      const { onViewChange } = setup()

      fireKey('g')
      fireKey('d')

      expect(onViewChange).not.toHaveBeenCalled()
    })

    it('does not fire onToday for the "t" following a "g"', () => {
      const { onToday } = setup()

      fireKey('g')
      fireKey('t')

      expect(onToday).not.toHaveBeenCalled()
    })

    it('resumes normal shortcut handling on the key after the suppressed one', () => {
      const { onViewChange } = setup()

      fireKey('g')
      fireKey('d')
      fireKey('d')

      expect(onViewChange).toHaveBeenCalledExactlyOnceWith('day')
    })

    describe('chord timeout', () => {
      beforeEach(() => {
        vi.useFakeTimers()
      })

      afterEach(() => {
        vi.useRealTimers()
      })

      it('stops suppressing once the chord timeout elapses', () => {
        const { onViewChange } = setup()

        fireKey('g')
        vi.advanceTimersByTime(1001)
        fireKey('d')

        expect(onViewChange).toHaveBeenCalledExactlyOnceWith('day')
      })
    })
  })
})
