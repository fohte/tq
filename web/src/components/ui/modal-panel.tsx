import { cn } from '#lib/utils'

function ModalPanel({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="modal-panel"
      className={cn(
        'flex max-h-full w-full max-w-150 flex-col overflow-hidden rounded-2xl bg-card shadow-2xl ring-1 ring-foreground/10',
        className,
      )}
      {...props}
    />
  )
}

export { ModalPanel }
