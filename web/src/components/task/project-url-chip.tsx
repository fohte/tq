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
}: {
  data: ProjectUrlData
  raw: string
}) {
  const { data: project } = useProjectUrlPreview(data.url)

  if (project == null) return <span>{raw}</span>
  const status = isProjectStatus(project.status) ? project.status : 'active'

  return (
    <PreviewCard>
      <PreviewCardTrigger
        render={<span />}
        className="inline-flex cursor-text items-center gap-1.5 border border-border bg-secondary/50 px-1.5 py-0.5 align-baseline text-sm leading-none"
      >
        <ProjectStatusMark status={status} />
        <span className="max-w-48 truncate">{project.title}</span>
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
