import { useEffect } from 'react'

const DIRECTION_LOCK_THRESHOLD_PX = 10
// Matches FullCalendar's default eventLongPressDelay/selectLongPressDelay
// (https://fullcalendar.io/docs/eventLongPressDelay).
const LONG_PRESS_MS = 1000
const SWIPE_COMMIT_THRESHOLD_PX = 50

// wheel has no gesture start/end event, so a trackpad's inertia keeps
// sending deltaX after the user's fingers have left — these bound one
// gesture to exactly one transition.
const WHEEL_LATCH_THRESHOLD_PX = 80
const WHEEL_GESTURE_END_MS = 300
// Rejects the horizontal component of a mostly-vertical scroll.
const WHEEL_DIRECTION_GATE_RATIO = 1.5

type Axis = 'horizontal' | 'vertical'

/**
 * Wires horizontal touch swipes and trackpad scrolls on `containerRef` to
 * prev/next day navigation. Vertical scrolling, FullCalendar's long-press
 * drag/selection, and the browser's own back/forward swipe gesture are left
 * alone — pair with `overscroll-behavior-x: contain` on the same element so
 * a horizontal wheel scroll can't fall through to the browser gesture.
 */
export function useCalendarSwipeNavigation(
  containerRef: React.RefObject<HTMLElement | null>,
  { onPrev, onNext }: { onPrev: () => void; onNext: () => void },
) {
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let touchStart: { x: number; y: number; time: number } | null = null
    let touchAxis: Axis | null = null
    let lastTouchX = 0

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0]
      if (e.touches.length !== 1 || !touch) {
        touchStart = null
        touchAxis = null
        return
      }
      touchStart = { x: touch.clientX, y: touch.clientY, time: Date.now() }
      lastTouchX = touch.clientX
      touchAxis = null
    }

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0]
      if (!touchStart || e.touches.length !== 1 || !touch) return
      lastTouchX = touch.clientX
      const dx = touch.clientX - touchStart.x
      const dy = touch.clientY - touchStart.y

      if (touchAxis === null) {
        if (Date.now() - touchStart.time > LONG_PRESS_MS) {
          touchAxis = 'vertical'
          return
        }
        if (
          Math.max(Math.abs(dx), Math.abs(dy)) < DIRECTION_LOCK_THRESHOLD_PX
        ) {
          return
        }
        touchAxis = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical'
      }

      if (touchAxis === 'horizontal') {
        e.preventDefault()
      }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.type === 'touchend' && touchAxis === 'horizontal' && touchStart) {
        const dx = lastTouchX - touchStart.x
        if (Math.abs(dx) >= SWIPE_COMMIT_THRESHOLD_PX) {
          if (dx < 0) {
            onNext()
          } else {
            onPrev()
          }
        }
      }
      touchStart = null
      touchAxis = null
    }

    let wheelAccumulatedX = 0
    let wheelLatched = false
    let wheelGestureEndTimeout: ReturnType<typeof setTimeout> | undefined

    const resetWheelGesture = () => {
      wheelAccumulatedX = 0
      wheelLatched = false
    }

    const handleWheel = (e: WheelEvent) => {
      // deltaMode 0 is DOM_DELTA_PIXEL (trackpad); classic wheel mice report
      // DOM_DELTA_LINE (1), which this excludes so a tilt-wheel doesn't
      // trigger navigation (https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaMode).
      if (e.deltaMode !== 0) return
      if (
        Math.abs(e.deltaX) <=
        Math.abs(e.deltaY) * WHEEL_DIRECTION_GATE_RATIO
      ) {
        return
      }

      e.preventDefault()
      clearTimeout(wheelGestureEndTimeout)
      wheelGestureEndTimeout = setTimeout(
        resetWheelGesture,
        WHEEL_GESTURE_END_MS,
      )

      if (wheelLatched) return

      wheelAccumulatedX += e.deltaX
      if (Math.abs(wheelAccumulatedX) >= WHEEL_LATCH_THRESHOLD_PX) {
        wheelLatched = true
        if (wheelAccumulatedX > 0) {
          onNext()
        } else {
          onPrev()
        }
      }
    }

    container.addEventListener('touchstart', handleTouchStart, {
      passive: true,
    })
    container.addEventListener('touchmove', handleTouchMove, {
      passive: false,
    })
    container.addEventListener('touchend', handleTouchEnd)
    container.addEventListener('touchcancel', handleTouchEnd)
    container.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
      container.removeEventListener('touchcancel', handleTouchEnd)
      container.removeEventListener('wheel', handleWheel)
      clearTimeout(wheelGestureEndTimeout)
    }
  }, [containerRef, onPrev, onNext])
}
