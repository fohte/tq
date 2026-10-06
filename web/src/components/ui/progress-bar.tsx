import { cn } from '#lib/utils'

function ProgressBar({
  percent,
  tone = 'foreground',
  className,
}: {
  percent: number
  tone?: 'foreground' | 'muted'
  className?: string
}) {
  const clamped = Math.min(100, Math.max(0, percent))

  return (
    <div className={cn('h-0.5 w-full bg-surface-strong', className)}>
      <div
        className={cn(
          'h-full w-(--progress-width)',
          tone === 'muted' ? 'bg-muted-foreground' : 'bg-foreground',
        )}
        style={
          {
            '--progress-width': `${String(clamped)}%`,
          } as React.CSSProperties & {
            '--progress-width': string
          }
        }
      />
    </div>
  )
}

export { ProgressBar }
