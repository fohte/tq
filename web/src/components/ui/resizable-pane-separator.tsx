import { useRef } from 'react'

interface ResizablePaneSeparatorProps {
  label: string
  value: number
  min: number
  max: number
  onValueChange: (value: number) => void
}

export function ResizablePaneSeparator({
  label,
  value,
  min,
  max,
  onValueChange,
}: ResizablePaneSeparatorProps) {
  const drag = useRef<{
    pointerId: number
    startX: number
    startValue: number
  } | null>(null)

  const updateValue = (nextValue: number) => {
    onValueChange(Math.min(max, Math.max(min, Math.round(nextValue))))
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
            updateValue(value - step)
            break
          case 'ArrowRight':
            event.preventDefault()
            updateValue(value + step)
            break
          case 'Home':
            event.preventDefault()
            updateValue(min)
            break
          case 'End':
            event.preventDefault()
            updateValue(max)
            break
        }
      }}
      onPointerCancel={(event) => {
        if (drag.current?.pointerId === event.pointerId) drag.current = null
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        event.preventDefault()
        drag.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startValue: value,
        }
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        const currentDrag = drag.current
        if (currentDrag?.pointerId !== event.pointerId) return
        updateValue(currentDrag.startValue + event.clientX - currentDrag.startX)
      }}
      onPointerUp={(event) => {
        if (drag.current?.pointerId === event.pointerId) drag.current = null
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
