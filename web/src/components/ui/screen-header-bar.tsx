import { cn } from '#lib/utils'

export function ScreenHeaderBar({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex h-10 shrink-0 items-center gap-2.5 border-b border-border bg-background px-3',
        className,
      )}
    >
      {children}
    </div>
  )
}
