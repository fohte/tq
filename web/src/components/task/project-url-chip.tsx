import { Chip } from '@fohte/ui/chip'
import { Link } from '@tanstack/react-router'

import { ProjectStatusBadge } from '#components/project/project-status-badge'
import {
  isProjectStatus,
  ProjectStatusMark,
} from '#components/project/project-status-mark'
import {
  PreviewCard,
  PreviewCardPopup,
  PreviewCardPortal,
  PreviewCardPositioner,
  PreviewCardTrigger,
} from '#components/ui/preview-card'
import { useProjectUrlPreview } from '#hooks/use-project-url-preview'
import type { ProjectUrlData } from '#lib/inline-reference/providers/project-url'

export function ProjectUrlChip({
  data,
  raw,
  defaultOpen,
}: {
  data: ProjectUrlData
  raw: string
  defaultOpen?: boolean | undefined
}) {
  const { data: project } = useProjectUrlPreview(data.id)

  if (project == null) return <span>{raw}</span>
  const status = isProjectStatus(project.status) ? project.status : 'active'

  return (
    <PreviewCard defaultOpen={defaultOpen}>
      <PreviewCardTrigger render={<span />}>
        <Chip size="md" tone="strong">
          <ProjectStatusMark status={status} />
          <span className="max-w-48 truncate">{project.title}</span>
        </Chip>
      </PreviewCardTrigger>
      <PreviewCardPortal>
        <PreviewCardPositioner>
          <PreviewCardPopup>
            <Link
              to="/projects/$projectId"
              params={{ projectId: project.id }}
              className="flex flex-col gap-1.5"
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                <ProjectStatusMark status={status} />
                <span>{project.title}</span>
                <ProjectStatusBadge status={project.status} />
              </div>
              {project.description != null && project.description !== '' && (
                <p className="line-clamp-3 text-xs text-muted-foreground">
                  {project.description}
                </p>
              )}
            </Link>
          </PreviewCardPopup>
        </PreviewCardPositioner>
      </PreviewCardPortal>
    </PreviewCard>
  )
}
