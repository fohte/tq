import { cn } from '@web/lib/utils'

type ProjectStatus = 'active' | 'paused' | 'completed' | 'archived'

const statusConfig: Record<
  ProjectStatus,
  { label: string; className: string }
> = {
  active: {
    label: 'Active',
    className: 'bg-[#1A3D20] text-[#4CAF50]',
  },
  paused: {
    label: 'Paused',
    className: 'bg-secondary text-muted-foreground',
  },
  completed: {
    label: 'Completed',
    className: 'bg-[#1A3D20] text-[#4CAF50]',
  },
  archived: {
    label: 'Archived',
    className: 'bg-secondary text-muted-foreground',
  },
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

export function ProjectStatusBadge({ status }: { status: string }) {
  if (!isProjectStatus(status)) return null
  const config = statusConfig[status]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
        config.className,
      )}
    >
      {config.label}
    </span>
  )
}
