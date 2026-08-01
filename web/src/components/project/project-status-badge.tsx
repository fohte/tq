import type { ProjectStatus } from '#components/project/project-status-mark'
import { isProjectStatus } from '#components/project/project-status-mark'
import { Chip } from '#components/ui/chip'
import { cn } from '#lib/utils'

export const statusLabels: Record<ProjectStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
  archived: 'Archived',
}

export function ProjectStatusBadge({
  status,
  className,
}: {
  status: string
  className?: string
}) {
  if (!isProjectStatus(status)) return null
  return (
    <Chip
      size="md"
      className={cn(
        status === 'active'
          ? 'text-muted-foreground-strong'
          : 'text-muted-foreground-faint',
        className,
      )}
    >
      {status}
    </Chip>
  )
}
