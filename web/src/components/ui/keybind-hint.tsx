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
        'font-mono text-2xs',
        variant === 'plain' && 'text-muted-foreground-ghost',
        variant === 'boxed' &&
          'inline-flex min-w-11 items-center justify-center rounded-(--keycap-radius) border border-border bg-secondary px-1.5 py-0.5 text-center text-foreground',
        className,
      )}
    >
      {children}
    </span>
  )
}

export { KeybindHint }
