import { createFileRoute, Link } from '@tanstack/react-router'
import {
  ProjectMainContent,
  ProjectSidebar,
  ProjectSidebarMobile,
} from '@web/components/project/project-detail'
import { useProject, useProjectTasks } from '@web/hooks/use-projects'
import { ChevronLeft, Loader2 } from 'lucide-react'

export const Route = createFileRoute('/projects/$projectId')({
  component: ProjectDetailPage,
})

function ProjectDetailPage() {
  const { projectId } = Route.useParams()
  const {
    data: project,
    isLoading: isProjectLoading,
    error,
  } = useProject(projectId)
  const { data: tasks, isLoading: isTasksLoading } = useProjectTasks(projectId)

  const isLoading = isProjectLoading || isTasksLoading

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Project not found</p>
      </div>
    )
  }

  return (
    <>
      {/* PC layout */}
      <div className="hidden h-full md:flex">
        <div className="flex-1 overflow-y-auto p-6">
          <ProjectMainContent project={project} tasks={tasks ?? []} />
        </div>
        <div className="w-60 shrink-0 overflow-y-auto border-l border-border p-4">
          <ProjectSidebar project={project} />
        </div>
      </div>

      {/* SP layout */}
      <div className="flex h-full flex-col overflow-y-auto md:hidden">
        <div className="flex h-12 shrink-0 items-center gap-1 border-b border-border px-3">
          <Link
            to="/projects"
            className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-5" />
            Projects
          </Link>
        </div>
        <div className="p-4">
          <ProjectMainContent project={project} tasks={tasks ?? []} />
        </div>
        <div className="border-t border-border p-4">
          <ProjectSidebarMobile project={project} />
        </div>
      </div>
    </>
  )
}
