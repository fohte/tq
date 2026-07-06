import type { ProjectView } from '@web/components/project/project-view-tabs'
import { ProjectViewTabs } from '@web/components/project/project-view-tabs'
import type { ProjectDetail } from '@web/hooks/use-projects'
import { cn } from '@web/lib/utils'

const statusLabels: Record<ProjectDetail['status'], string> = {
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
  archived: 'Archived',
}

const statusColors: Record<ProjectDetail['status'], string> = {
  active: 'bg-primary/15 text-primary',
  paused: 'bg-muted-foreground/15 text-muted-foreground',
  completed: 'bg-[#4CAF50]/15 text-[#4CAF50]',
  archived: 'bg-muted-foreground/15 text-muted-foreground',
}

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

  return (
    <div className="space-y-3 px-4 py-3">
      {/* Title row */}
      <div className="flex items-center gap-3">
        {project.color != null && (
          <span
            className="h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: project.color }}
          />
        )}
        <h1 className="text-lg font-semibold text-foreground">
          {project.title}
        </h1>
        <span
          className={cn(
            'rounded-full px-2.5 py-0.5 text-xs font-medium',
            statusColors[project.status],
          )}
        >
          {statusLabels[project.status]}
        </span>
        <div className="ml-auto">
          <ProjectViewTabs view={view} onViewChange={onViewChange} />
        </div>
      </div>

      {/* Progress section */}
      <div className="space-y-1.5">
        {hasDateRange && (
          <p className="text-xs text-muted-foreground">
            {startFormatted ?? '—'}
            {' → '}
            {targetFormatted ?? '—'}
          </p>
        )}

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-[#4CAF50] transition-all duration-300"
            style={{ width: `${String(progress)}%` }}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          {project.taskCount.completed}/{project.taskCount.total} completed
          {project.taskCount.total > 0 && (
            <span> ({Math.round(progress)}%)</span>
          )}
        </p>
      </div>
    </div>
  )
}
