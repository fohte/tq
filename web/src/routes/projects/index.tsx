import { createFileRoute, Link } from '@tanstack/react-router'
import { useProjects } from '@web/hooks/use-projects'
import { cn } from '@web/lib/utils'

export const Route = createFileRoute('/projects/')({
  component: ProjectList,
})

const statusColors: Record<string, string> = {
  active: 'bg-primary/15 text-primary',
  paused: 'bg-muted-foreground/15 text-muted-foreground',
  completed: 'bg-[#4CAF50]/15 text-[#4CAF50]',
  archived: 'bg-muted-foreground/15 text-muted-foreground',
}

function ProjectList() {
  const { data: projects, isLoading } = useProjects()

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <h1 className="text-lg font-semibold">Projects</h1>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Loading...
          </div>
        ) : !projects || projects.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No projects yet
          </div>
        ) : (
          <div className="py-1">
            {projects.map((project) => (
              <Link
                key={project.id}
                to="/projects/$projectId"
                params={{ projectId: project.id }}
                className="flex items-center gap-3 border-b border-border px-4 py-3 transition-colors hover:bg-secondary/30"
              >
                {project.color != null && (
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: project.color }}
                  />
                )}
                <span className="flex-1 truncate text-sm font-medium">
                  {project.title}
                </span>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium',
                    statusColors[project.status] ?? statusColors['active'],
                  )}
                >
                  {project.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
