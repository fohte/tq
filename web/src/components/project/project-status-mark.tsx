import { cn } from '#lib/utils'

export type ProjectStatus = 'active' | 'paused' | 'completed' | 'archived'

export function ProjectStatusMark({
  status,
  size = 7,
  className,
}: {
  status: ProjectStatus
  size?: 7 | 9
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-block shrink-0',
        status === 'active' && 'bg-foreground',
        status === 'completed' && 'bg-muted-foreground-faint',
        (status === 'paused' || status === 'archived') &&
          'border border-muted-foreground',
        className,
      )}
      style={{ width: size, height: size }}
    />
  )
}
