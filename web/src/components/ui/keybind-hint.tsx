import { cn } from '#lib/utils'

function KeybindHint({
  variant = 'plain',
  className,
  children,
}: {
  variant?: 'plain' | 'boxed'
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        'font-mono',
        variant === 'plain' && 'text-2xs text-muted-foreground-ghost',
        variant === 'boxed' &&
          'inline-flex min-w-[44px] items-center justify-center rounded-[4px] border border-border bg-secondary px-1.5 py-0.5 text-center text-2xs text-foreground',
        className,
      )}
    >
      {children}
    </span>
  )
}

export { KeybindHint }
