import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'

import { LinkExistingProjectTaskMenu } from '#components/project/link-existing-project-task-menu'
import { ProjectBoardHeader } from '#components/project/project-board-header'
import {
  ProjectFilterBar,
  type SortOption,
  type StatusFilter,
} from '#components/project/project-filter-bar'
import { ProjectGanttView } from '#components/project/project-gantt-view'
import { ProjectTaskList } from '#components/project/project-task-list'
import type { ProjectView } from '#components/project/project-view-tabs'
import { FloatingActionButton } from '#components/task/create-task-inline'
import { CreateTaskModal } from '#components/task/create-task-modal'
import { FullPageLoading } from '#components/ui/full-page-loading'
import { FullPageMessage } from '#components/ui/full-page-message'
import { useProject, useProjectTasks } from '#hooks/use-projects'

export const Route = createFileRoute('/projects/$projectId_/board')({
  component: ProjectBoardPage,
})

function ProjectBoardPage() {
  const { projectId } = Route.useParams()
  const { data: project, isLoading: isProjectLoading } = useProject(projectId)
  const { data: tasks, isLoading: isTasksLoading } = useProjectTasks(projectId)

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortOption, setSortOption] = useState<SortOption>('manual')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLinkExistingOpen, setIsLinkExistingOpen] = useState(false)
  const [view, setView] = useState<ProjectView>('list')

  const isLoading = isProjectLoading || isTasksLoading

  if (isLoading) {
    return <FullPageLoading />
  }

  if (!project) {
    return <FullPageMessage>Project not found</FullPageMessage>
  }

  return (
    <div className="flex h-full flex-col">
      {/* SP: Back button header */}
      <div className="flex h-12 items-center gap-2 border-b border-border px-3 md:hidden">
        <Link
          to="/projects/$projectId"
          params={{ projectId }}
          className="flex h-8 w-8 items-center justify-center text-muted-foreground"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
      </div>

      {/* Header */}
      <ProjectBoardHeader
        project={project}
        view={view}
        onViewChange={setView}
      />

      {view === 'list' ? (
        <>
          {/* Filter bar */}
          <ProjectFilterBar
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            sortOption={sortOption}
            onSortOptionChange={setSortOption}
            onAddTask={() => {
              setIsModalOpen(true)
            }}
            onLinkExistingTask={() => {
              setIsLinkExistingOpen(true)
            }}
          />

          {/* Task list */}
          <div className="flex-1 overflow-auto">
            <ProjectTaskList
              tasks={tasks ?? []}
              statusFilter={statusFilter}
              sortOption={sortOption}
            />
          </div>
        </>
      ) : (
        <div className="min-h-0 flex-1">
          <ProjectGanttView tasks={tasks ?? []} />
        </div>
      )}

      {/* FAB (mobile only) */}
      <FloatingActionButton
        onClick={() => {
          setIsModalOpen(true)
        }}
      />

      {/* Task create modal */}
      <CreateTaskModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        projectId={projectId}
      />

      {/* Link existing task menu */}
      <LinkExistingProjectTaskMenu
        open={isLinkExistingOpen}
        onOpenChange={setIsLinkExistingOpen}
        projectId={projectId}
        projectTitle={project.title}
        excludedTaskIds={new Set((tasks ?? []).map((t) => t.id))}
      />
    </div>
  )
}
