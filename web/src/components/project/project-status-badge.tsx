import { Chip } from '#components/ui/chip'
import { cn } from '#lib/utils'

export type ProjectStatus = 'active' | 'paused' | 'completed' | 'archived'

export const statusLabels: Record<ProjectStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
  archived: 'Archived',
}

const validStatuses = new Set<string>([
  'active',
  'paused',
  'completed',
  'archived',
])

function isProjectStatus(value: string): value is ProjectStatus {
  return validStatuses.has(value)
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
