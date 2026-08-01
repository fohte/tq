import { ProjectStatusBadge } from '#components/project/project-status-badge'
import { ProjectStatusMark } from '#components/project/project-status-mark'
import type { ProjectView } from '#components/project/project-view-tabs'
import { ProjectViewTabs } from '#components/project/project-view-tabs'
import { ProgressBar } from '#components/ui/progress-bar'
import type { ProjectDetail } from '#hooks/use-projects'

function formatDate(dateStr: string | null): string | null {
  if (dateStr == null) return null
  const date = new Date(`${dateStr}T00:00:00`)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function ProjectBoardHeader({
  project,
  view,
  onViewChange,
}: {
  project: ProjectDetail
  view: ProjectView
  onViewChange: (view: ProjectView) => void
}) {
  const progress =
    project.taskCount.total > 0
      ? (project.taskCount.completed / project.taskCount.total) * 100
      : 0

  const startFormatted = formatDate(project.startDate)
  const targetFormatted = formatDate(project.targetDate)
  const hasDateRange = startFormatted != null || targetFormatted != null
  const fillClassName =
    project.status === 'active' ? 'bg-foreground' : 'bg-muted-foreground'

  return (
    <div className="space-y-3 px-4 py-3">
      {/* Title row */}
      <div className="flex items-center gap-3">
        <ProjectStatusMark status={project.status} size={9} />
        <h1 className="font-mono text-lg font-bold text-foreground">
          {project.title}
        </h1>
        <ProjectStatusBadge status={project.status} />
        <div className="ml-auto">
          <ProjectViewTabs view={view} onViewChange={onViewChange} />
        </div>
      </div>

      {/* Progress section */}
      <div className="space-y-1.5">
        {hasDateRange && (
          <p className="font-mono text-xs text-muted-foreground">
            {startFormatted ?? '—'}
            {' → '}
            {targetFormatted ?? '—'}
          </p>
        )}

        <ProgressBar percent={progress} fillClassName={fillClassName} />

        <p className="font-mono text-xs text-muted-foreground">
          {project.taskCount.completed}/{project.taskCount.total} completed
          {project.taskCount.total > 0 && (
            <span> ({Math.round(progress)}%)</span>
          )}
        </p>
      </div>
    </div>
  )
}
