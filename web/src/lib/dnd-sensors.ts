import type { DragStartEvent } from '@dnd-kit/core'
import { MouseSensor, TouchSensor } from '@dnd-kit/core'
import { useState } from 'react'

// Nested interactive controls (status picker, actions menu, expand toggle)
// only stopPropagation() on click, not pointerdown/touchstart, so a plain
// distance/delay activation constraint can still misfire a drag from pointer
// jitter while a user is trying to click one of them. These sensor
// subclasses skip activation when the pointer/touch originates inside an
// element marked data-no-dnd, following dnd-kit's documented pattern for
// excluding nested interactive elements from drag activation.
function shouldHandleDrag(target: EventTarget | null): boolean {
  let el = target instanceof HTMLElement ? target : null
  while (el != null) {
    if (el.dataset['noDnd'] != null) return false
    el = el.parentElement
  }
  return true
}

export class NoDndMouseSensor extends MouseSensor {
  static override activators = [
    {
      eventName: 'onMouseDown' as const,
      handler: ({ nativeEvent }: React.MouseEvent) =>
        shouldHandleDrag(nativeEvent.target),
    },
  ]
}

export class NoDndTouchSensor extends TouchSensor {
  static override activators = [
    {
      eventName: 'onTouchStart' as const,
      handler: ({ nativeEvent }: React.TouchEvent) =>
        shouldHandleDrag(nativeEvent.target),
    },
  ]
}

/**
 * DragOverlay doesn't auto-size to the source row/card, so its width is
 * captured once on drag start and held for the duration of the drag.
 */
export function useDragOverlayWidth() {
  const [width, setWidth] = useState<number | null>(null)

  const captureWidth = (event: DragStartEvent) => {
    setWidth(event.active.rect.current.initial?.width ?? null)
  }

  const resetWidth = () => {
    setWidth(null)
  }

  return { width, captureWidth, resetWidth }
}
