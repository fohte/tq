import { Link } from '@tanstack/react-router'
import { ColorDot } from '@web/components/project/color-dot'
import { ProjectStatusBadge } from '@web/components/project/project-status-badge'
import type { Project } from '@web/hooks/use-projects'

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      to="/projects/$projectId"
      params={{ projectId: project.id }}
      className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-card/80"
    >
      <ColorDot color={project.color} size={12} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-sm font-semibold text-foreground">
          {project.title}
        </span>
        {project.description != null && project.description !== '' && (
          <span className="truncate text-xs text-muted-foreground">
            {project.description}
          </span>
        )}
        <ProjectStatusBadge status={project.status} />
      </div>
    </Link>
  )
}
