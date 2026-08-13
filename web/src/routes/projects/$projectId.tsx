import { createFileRoute } from '@tanstack/react-router'

import {
  ProjectMainContent,
  ProjectSidebar,
  ProjectSidebarMobile,
} from '#components/project/project-detail'
import { BackHeaderBar } from '#components/ui/back-header-bar'
import { FullPageLoading } from '#components/ui/full-page-loading'
import { FullPageMessage } from '#components/ui/full-page-message'
import { useProject, useProjectTasks } from '#hooks/use-projects'

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
    return <FullPageLoading />
  }

  if (error || !project) {
    return <FullPageMessage>Project not found</FullPageMessage>
  }

  return (
    <>
      {/* PC layout */}
      <div className="hidden h-full md:flex">
        <div className="flex-1 overflow-y-auto p-6">
          <ProjectMainContent
            key={project.id}
            project={project}
            tasks={tasks ?? []}
          />
        </div>
        <ProjectSidebar key={project.id} project={project} />
      </div>

      {/* SP layout */}
      <div className="flex h-full flex-col overflow-y-auto md:hidden">
        <BackHeaderBar to="/projects">Projects</BackHeaderBar>
        <div className="p-4">
          <ProjectMainContent
            key={project.id}
            project={project}
            tasks={tasks ?? []}
          />
        </div>
        <div className="border-t border-border p-4">
          <ProjectSidebarMobile key={project.id} project={project} />
        </div>
      </div>
    </>
  )
}
