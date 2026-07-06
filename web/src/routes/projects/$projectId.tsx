import { createFileRoute } from '@tanstack/react-router'
import { ProjectBoardHeader } from '@web/components/project/project-board-header'
import {
  ProjectFilterBar,
  type SortOption,
  type StatusFilter,
} from '@web/components/project/project-filter-bar'
import { ProjectGanttView } from '@web/components/project/project-gantt-view'
import { ProjectTaskList } from '@web/components/project/project-task-list'
import type { ProjectView } from '@web/components/project/project-view-tabs'
import { FloatingActionButton } from '@web/components/task/create-task-inline'
import { CreateTaskModal } from '@web/components/task/create-task-modal'
import { useProject, useProjectTasks } from '@web/hooks/use-projects'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'

export const Route = createFileRoute('/projects/$projectId')({
  component: ProjectDetail,
})

function ProjectDetail() {
  const { projectId } = Route.useParams()
  const { data: project, isLoading: isProjectLoading } = useProject(projectId)
  const { data: tasks, isLoading: isTasksLoading } = useProjectTasks(projectId)

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortOption, setSortOption] = useState<SortOption>('manual')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [view, setView] = useState<ProjectView>('list')

  const isLoading = isProjectLoading || isTasksLoading

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading...
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Project not found
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* SP: Back button header */}
      <div className="flex h-12 items-center gap-2 border-b border-border px-3 md:hidden">
        <button
          type="button"
          onClick={() => {
            window.history.back()
          }}
          className="flex h-8 w-8 items-center justify-center text-muted-foreground"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
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
    </div>
  )
}
