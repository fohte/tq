import type { VisualViewportInsets } from '#hooks/use-visual-viewport-insets'
import { useVisualViewportInsets } from '#hooks/use-visual-viewport-insets'
import { cn } from '#lib/utils'

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
