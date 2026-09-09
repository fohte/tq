import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useCalendarSwipeNavigation } from '#hooks/use-calendar-swipe-navigation'

function touchPoint(x: number, y: number): Touch {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- jsdom has no Touch constructor; only clientX/clientY are read
  return { clientX: x, clientY: y } as Touch
}

function fireTouch(
  type: 'touchstart' | 'touchmove' | 'touchend' | 'touchcancel',
  target: EventTarget,
  touches: Touch[] = [],
) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'touches', { value: touches })
  target.dispatchEvent(event)
  return event
}

function fireWheel(
  target: EventTarget,
  init: { deltaX: number; deltaY?: number; deltaMode?: number },
) {
  const event = new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    deltaX: init.deltaX,
    deltaY: init.deltaY ?? 0,
    deltaMode: init.deltaMode ?? 0,
  })
  target.dispatchEvent(event)
  return event
}

function setup() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const onPrev = vi.fn()
  const onNext = vi.fn()
  renderHook(() => {
    useCalendarSwipeNavigation({ current: container }, { onPrev, onNext })
  })
  return { container, onPrev, onNext }
}

describe('useCalendarSwipeNavigation', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  describe('touch', () => {
    it('calls onNext on a leftward swipe past the commit threshold', () => {
      const { container, onNext } = setup()

      fireTouch('touchstart', container, [touchPoint(200, 100)])
      fireTouch('touchmove', container, [touchPoint(140, 100)])
      fireTouch('touchend', container)

      expect(onNext).toHaveBeenCalledTimes(1)
    })

    it('calls onPrev on a rightward swipe past the commit threshold', () => {
      const { container, onPrev } = setup()

      fireTouch('touchstart', container, [touchPoint(100, 100)])
      fireTouch('touchmove', container, [touchPoint(160, 100)])
      fireTouch('touchend', container)

      expect(onPrev).toHaveBeenCalledTimes(1)
    })

    it('does not navigate when the swipe stays under the commit threshold', () => {
      const { container, onPrev, onNext } = setup()

      fireTouch('touchstart', container, [touchPoint(100, 100)])
      fireTouch('touchmove', container, [touchPoint(120, 100)])
      fireTouch('touchend', container)

      expect(onPrev).not.toHaveBeenCalled()
      expect(onNext).not.toHaveBeenCalled()
    })

    it('locks to vertical and ignores horizontal movement once vertical wins the direction lock', () => {
      const { container, onPrev, onNext } = setup()

      fireTouch('touchstart', container, [touchPoint(100, 100)])
      // Vertical delta wins the initial direction-lock decision.
      fireTouch('touchmove', container, [touchPoint(105, 130)])
      // Even though this leg is a large horizontal move, the axis is
      // already locked to vertical for the rest of the gesture.
      fireTouch('touchmove', container, [touchPoint(200, 130)])
      fireTouch('touchend', container)

      expect(onPrev).not.toHaveBeenCalled()
      expect(onNext).not.toHaveBeenCalled()
    })

    it('calls preventDefault on touchmove once locked to horizontal', () => {
      const { container } = setup()

      fireTouch('touchstart', container, [touchPoint(200, 100)])
      const moveEvent = fireTouch('touchmove', container, [
        touchPoint(140, 100),
      ])

      expect(moveEvent.defaultPrevented).toBe(true)
    })

    it('does not navigate for a multi-touch gesture', () => {
      const { container, onPrev, onNext } = setup()

      fireTouch('touchstart', container, [
        touchPoint(200, 100),
        touchPoint(50, 100),
      ])
      fireTouch('touchmove', container, [
        touchPoint(140, 100),
        touchPoint(50, 100),
      ])
      fireTouch('touchend', container)

      expect(onPrev).not.toHaveBeenCalled()
      expect(onNext).not.toHaveBeenCalled()
    })

    it('does not navigate when the gesture is cancelled instead of completed', () => {
      const { container, onNext } = setup()

      fireTouch('touchstart', container, [touchPoint(200, 100)])
      fireTouch('touchmove', container, [touchPoint(140, 100)])
      fireTouch('touchcancel', container)

      expect(onNext).not.toHaveBeenCalled()
    })

    describe('long-press gate', () => {
      beforeEach(() => {
        vi.useFakeTimers()
      })

      afterEach(() => {
        vi.useRealTimers()
      })

      it('gives up on swipe once the long-press window elapses before a direction is locked', () => {
        const { container, onNext } = setup()

        fireTouch('touchstart', container, [touchPoint(200, 100)])
        vi.advanceTimersByTime(1001)
        fireTouch('touchmove', container, [touchPoint(140, 100)])
        fireTouch('touchend', container)

        expect(onNext).not.toHaveBeenCalled()
      })
    })
  })

  describe('wheel', () => {
    it('calls onNext once accumulated rightward deltaX crosses the latch threshold', () => {
      const { container, onNext } = setup()

      fireWheel(container, { deltaX: 50 })
      fireWheel(container, { deltaX: 40 })

      expect(onNext).toHaveBeenCalledTimes(1)
    })

    it('calls onPrev once accumulated leftward deltaX crosses the latch threshold', () => {
      const { container, onPrev } = setup()

      fireWheel(container, { deltaX: -50 })
      fireWheel(container, { deltaX: -40 })

      expect(onPrev).toHaveBeenCalledTimes(1)
    })

    it('collapses one gesture into a single transition despite continued inertia deltas', () => {
      const { container, onNext } = setup()

      fireWheel(container, { deltaX: 90 })
      fireWheel(container, { deltaX: 20 })
      fireWheel(container, { deltaX: 20 })

      expect(onNext).toHaveBeenCalledTimes(1)
    })

    it('ignores classic wheel mice (DOM_DELTA_LINE)', () => {
      const { container, onNext } = setup()

      fireWheel(container, { deltaX: 100, deltaMode: 1 })

      expect(onNext).not.toHaveBeenCalled()
    })

    it('ignores a mostly-vertical scroll', () => {
      const { container, onPrev, onNext } = setup()

      fireWheel(container, { deltaX: 30, deltaY: 100 })

      expect(onPrev).not.toHaveBeenCalled()
      expect(onNext).not.toHaveBeenCalled()
    })

    describe('gesture-end timeout', () => {
      beforeEach(() => {
        vi.useFakeTimers()
      })

      afterEach(() => {
        vi.useRealTimers()
      })

      it('allows another transition once the gesture-end timeout resets the latch', () => {
        const { container, onNext } = setup()

        fireWheel(container, { deltaX: 90 })
        expect(onNext).toHaveBeenCalledTimes(1)

        vi.advanceTimersByTime(301)

        fireWheel(container, { deltaX: 90 })
        expect(onNext).toHaveBeenCalledTimes(2)
      })
    })
  })
})
