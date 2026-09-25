import { useVisualViewportInsets } from '#hooks/use-visual-viewport-insets'
import { cn } from '#lib/utils'

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
        'pointer-events-none fixed inset-x-0 z-50 flex items-end',
        insets === null && 'inset-y-0',
        className,
        insets !== null &&
          'top-(--visual-viewport-top) h-(--visual-viewport-height)',
      )}
      style={
        insets === null
          ? style
          : ({
              '--visual-viewport-top': `${String(insets.top)}px`,
              '--visual-viewport-height': `${String(insets.height)}px`,
            } as React.CSSProperties & {
              '--visual-viewport-top': string
              '--visual-viewport-height': string
            })
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
        'pointer-events-auto max-h-sheet w-full overflow-y-auto rounded-t-xl bg-card pb-5 shadow-2xl ring-1 ring-foreground/10',
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
