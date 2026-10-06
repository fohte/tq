import { cn } from '#lib/utils'

export function ScreenHeaderBar({
  children,
  className,
  spacing = 'normal',
}: {
  children: React.ReactNode
  className?: string
  spacing?: 'normal' | 'compact'
}) {
  return (
    <div
      className={cn(
        'flex h-10 shrink-0 items-center gap-2.5 border-b border-border bg-background px-3',
        spacing === 'compact' && 'gap-1.5 sm:gap-2.5',
        className,
      )}
    >
      {children}
    </div>
  )
}
