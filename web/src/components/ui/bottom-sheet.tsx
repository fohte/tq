import { cn } from '#lib/utils'

function BottomSheetPanel({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="bottom-sheet-panel"
      className={cn(
        'max-h-[85vh] w-full overflow-y-auto rounded-t-xl bg-card pb-5 shadow-2xl ring-1 ring-foreground/10',
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

export { BottomSheetHeader, BottomSheetPanel }
