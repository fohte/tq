import { cn } from '#lib/utils'

function ProgressBar({
  percent,
  fillClassName = 'bg-foreground',
  className,
}: {
  percent: number
  fillClassName?: string
  className?: string
}) {
  const clamped = Math.min(100, Math.max(0, percent))

  return (
    <div className={cn('h-0.5 w-full bg-surface-strong', className)}>
      <div
        className={cn('h-full', fillClassName)}
        style={{ width: `${String(clamped)}%` }}
      />
    </div>
  )
}

export { ProgressBar }
