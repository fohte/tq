import { cn } from '#lib/utils'

function DetailSidebarPanel({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="detail-sidebar-panel"
      className={cn(
        'sticky top-0 flex h-screen w-60 shrink-0 flex-col gap-4 overflow-y-auto border-l border-border p-4',
        className,
      )}
      {...props}
    />
  )
}

export { DetailSidebarPanel }
