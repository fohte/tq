import { useRef } from 'react'

import { clampPaneWidth } from '#lib/resizable-pane-width'

interface ResizablePaneSeparatorProps {
  label: string
  value: number
  min: number
  max: number
  onValueChange: (value: number) => void
  onValueCommit: (value: number) => void
}

export function ResizablePaneSeparator({
  label,
  value,
  min,
  max,
  onValueChange,
  onValueCommit,
}: ResizablePaneSeparatorProps) {
  const drag = useRef<{
    pointerId: number
    startX: number
    startValue: number
    lastValue: number
  } | null>(null)

  const updateValue = (nextValue: number, commit = false) => {
    const next = clampPaneWidth(nextValue, min, max)
    onValueChange(next)
    if (commit) onValueCommit(next)
    return next
  }

  return (
    <div
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemax={max}
      aria-valuemin={min}
      aria-valuenow={Math.round(value)}
      className="group absolute inset-y-0 right-0 z-20 hidden w-2 touch-none cursor-col-resize items-center justify-center bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary md:flex"
      onKeyDown={(event) => {
        const step = event.shiftKey ? 50 : 10
        switch (event.key) {
          case 'ArrowLeft':
            event.preventDefault()
            updateValue(value - step, true)
            break
          case 'ArrowRight':
            event.preventDefault()
            updateValue(value + step, true)
            break
          case 'Home':
            event.preventDefault()
            updateValue(min, true)
            break
          case 'End':
            event.preventDefault()
            updateValue(max, true)
            break
        }
      }}
      onPointerCancel={(event) => {
        const currentDrag = drag.current
        if (currentDrag?.pointerId !== event.pointerId) return
        onValueCommit(currentDrag.lastValue)
        drag.current = null
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        event.preventDefault()
        drag.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startValue: value,
          lastValue: value,
        }
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        const currentDrag = drag.current
        if (currentDrag?.pointerId !== event.pointerId) return
        currentDrag.lastValue = updateValue(
          currentDrag.startValue + event.clientX - currentDrag.startX,
        )
      }}
      onPointerUp={(event) => {
        const currentDrag = drag.current
        if (currentDrag?.pointerId !== event.pointerId) return
        updateValue(
          currentDrag.startValue + event.clientX - currentDrag.startX,
          true,
        )
        drag.current = null
      }}
      role="separator"
      tabIndex={0}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 right-0 w-px bg-border transition-colors group-hover:bg-primary/70 group-focus-visible:bg-primary group-active:bg-primary"
      />
    </div>
  )
}
