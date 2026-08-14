import { Link } from '@tanstack/react-router'

import { formatDate } from '#components/project/project-detail-utils'
import { ProjectStatusBadge } from '#components/project/project-status-badge'
import {
  isProjectStatus,
  ProjectStatusMark,
} from '#components/project/project-status-mark'
import { preventClickWhileSelecting } from '#components/task/prevent-click-while-selecting'
import { ProgressBar } from '#components/ui/progress-bar'
import { useProjectUrlPreview } from '#hooks/use-project-url-preview'
import type { ProjectUrlData } from '#lib/inline-reference/providers/project-url'

export function ProjectUrlCard({
  data,
  raw,
}: {
  data: ProjectUrlData
  raw: string
}) {
  const { data: project } = useProjectUrlPreview(data.url)

  if (project == null) return <span>{raw}</span>

  const status = isProjectStatus(project.status) ? project.status : 'active'
  const total = project.taskCount.total
  const completed = project.taskCount.completed
  const percent = total > 0 ? (completed / total) * 100 : 0
  const fillClassName =
    status === 'active' ? 'bg-foreground' : 'bg-muted-foreground'

  return (
    <Link
      to="/projects/$projectId"
      params={{ projectId: project.id }}
      onClick={preventClickWhileSelecting}
      onMouseUp={(event) => {
        event.stopPropagation()
      }}
      className="flex flex-col gap-1.5 border border-border bg-card p-3"
    >
      <div className="flex items-center gap-2">
        <ProjectStatusMark status={status} />
        <p className="line-clamp-1 flex-1 font-sans text-sm font-medium">
          {project.title}
        </p>
        <ProjectStatusBadge status={project.status} />
      </div>
      {project.description != null && project.description !== '' && (
        <p className="line-clamp-2 font-sans text-xs text-muted-foreground">
          {project.description}
        </p>
      )}
      <div className="flex items-center gap-2.5">
        <ProgressBar
          percent={percent}
          fillClassName={fillClassName}
          className="flex-1"
        />
        <span className="shrink-0 font-mono text-2xs text-muted-foreground">
          {completed}/{total}
        </span>
      </div>
      {project.targetDate != null && (
        <span className="font-mono text-2xs text-muted-foreground-strong">
          {formatDate(project.targetDate)}
        </span>
      )}
    </Link>
  )
}
