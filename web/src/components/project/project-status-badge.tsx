import { Chip } from '@fohte/ui/chip'

import type { ProjectStatus } from '#components/project/project-status-mark'
import { isProjectStatus } from '#components/project/project-status-mark'

export const statusLabels: Record<ProjectStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
  archived: 'Archived',
}

export function ProjectStatusBadge({ status }: { status: string }) {
  if (!isProjectStatus(status)) return null
  return (
    <Chip size="md" tone={status === 'active' ? 'strong' : 'faint'}>
      {status}
    </Chip>
  )
}
