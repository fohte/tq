import { Link } from '@tanstack/react-router'

import { ProjectStatusBadge } from '#components/project/project-status-badge'
import {
  type ProjectStatus,
  ProjectStatusMark,
} from '#components/project/project-status-mark'
import { ProgressBar } from '#components/ui/progress-bar'
import type { Project } from '#hooks/use-projects'
import { cn } from '#lib/utils'

const validStatuses = new Set<string>([
  'active',
  'paused',
  'completed',
  'archived',
])

function isProjectStatus(value: string): value is ProjectStatus {
  return validStatuses.has(value)
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

export function ProjectListRow({ project }: { project: Project }) {
  const status: ProjectStatus = isProjectStatus(project.status)
    ? project.status
    : 'active'
  const total = project.taskCount.total
  const completed = project.taskCount.completed
  const percent = total > 0 ? (completed / total) * 100 : 0
  const targetLabel = formatDate(project.targetDate) ?? '—'
  const fillClassName =
    status === 'active' ? 'bg-foreground' : 'bg-muted-foreground'

  return (
    <Link
      to="/projects/$projectId"
      params={{ projectId: project.id }}
      className="contents"
    >
      {/* Desktop row */}
      <div className="hidden items-center gap-3 border-b border-border px-3.5 py-[11px] hover:bg-card md:grid md:grid-cols-[14px_1fr_96px_190px_78px]">
        <ProjectStatusMark status={status} />
        <div className="flex min-w-0 flex-col gap-[3px]">
          <span className="truncate font-mono text-[13px] font-medium text-foreground">
            {project.title}
          </span>
          {project.description != null && project.description !== '' && (
            <span className="truncate text-xs text-muted-foreground">
              {project.description}
            </span>
          )}
        </div>
        <ProjectStatusBadge status={project.status} />
        <div className="flex items-center gap-[9px]">
          <ProgressBar
            percent={percent}
            fillClassName={fillClassName}
            className="flex-1"
          />
          <span className="w-11 shrink-0 text-right font-mono text-[10px] text-muted-foreground">
            {completed}/{total}
          </span>
        </div>
        <span
          className={cn(
            'text-right font-mono text-[11px]',
            project.targetDate != null
              ? 'text-muted-foreground-strong'
              : 'text-muted-foreground-faint',
          )}
        >
          {targetLabel}
        </span>
      </div>

      {/* Mobile row */}
      <div className="flex flex-col gap-2 border-b border-border px-3.5 py-[13px] md:hidden">
        <div className="flex items-center gap-2">
          <ProjectStatusMark status={status} />
          <span className="font-mono text-[13px] font-medium text-foreground">
            {project.title}
          </span>
          <ProjectStatusBadge status={project.status} />
          <span className="ml-auto font-mono text-[10px] text-muted-foreground">
            {completed}/{total}
          </span>
        </div>
        <ProgressBar percent={percent} fillClassName={fillClassName} />
      </div>
    </Link>
  )
}
