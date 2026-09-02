import { useEffect, useState } from 'react'

import { cn } from '#lib/utils'

interface VisualViewportInsets {
  top: number
  height: number
}

function getVisualViewportInsets(): VisualViewportInsets | null {
  const viewport = window.visualViewport
  if (!viewport) return null
  return { top: viewport.offsetTop, height: viewport.height }
}

// iOS Safari doesn't shrink the layout viewport when the software keyboard
// opens, so a `position: fixed` sheet anchored to `inset-0` renders behind
// it. Track the visual viewport instead and reposition to match.
function useVisualViewportInsets(): VisualViewportInsets | null {
  const [insets, setInsets] = useState(getVisualViewportInsets)

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return

    const handleChange = () => {
      setInsets(getVisualViewportInsets())
    }
    viewport.addEventListener('resize', handleChange)
    viewport.addEventListener('scroll', handleChange)
    return () => {
      viewport.removeEventListener('resize', handleChange)
      viewport.removeEventListener('scroll', handleChange)
    }
  }, [])

  return insets
}

interface VisualViewportStyle extends React.CSSProperties {
  '--visual-viewport-height': string
}

function visualViewportInsetStyle(
  insets: VisualViewportInsets,
): VisualViewportStyle {
  return {
    top: insets.top,
    height: insets.height,
    '--visual-viewport-height': `${String(insets.height)}px`,
  }
}

function BottomSheetOverlay({
  className,
  style,
  ...props
}: React.ComponentProps<'div'>) {
  const insets = useVisualViewportInsets()

  return (
    <div
      data-slot="bottom-sheet-overlay"
      className={cn(
        'fixed inset-x-0 z-50 flex items-end',
        insets === null && 'inset-y-0',
        className,
      )}
      style={
        insets === null
          ? style
          : { ...style, ...visualViewportInsetStyle(insets) }
      }
      {...props}
    />
  )
}

function BottomSheetPanel({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="bottom-sheet-panel"
      className={cn(
        'max-h-sheet w-full overflow-y-auto rounded-t-xl bg-card pb-5 shadow-2xl ring-1 ring-foreground/10',
        className,
      )}
      {...props}
    />
  )
}

function BottomSheetHeader({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="bottom-sheet-header"
      className={cn(
        'sticky top-0 z-10 flex h-12 items-center justify-between border-b border-border bg-card px-4',
        className,
      )}
      {...props}
    />
  )
}

export { BottomSheetHeader, BottomSheetOverlay, BottomSheetPanel }
