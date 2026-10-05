import { Chip } from '@fohte/ui/chip'

import { useProject } from '#hooks/use-projects'

export function ProjectChip({ projectId }: { projectId: string }) {
  const { data: project } = useProject(projectId)

  return <Chip>project: {project?.title ?? '…'}</Chip>
}
