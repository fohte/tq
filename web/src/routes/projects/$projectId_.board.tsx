import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

import { LinkExistingProjectTaskMenu } from '#components/project/link-existing-project-task-menu'
import { ProjectBoardHeader } from '#components/project/project-board-header'
import {
  ProjectFilterBar,
  type SortOption,
  type StatusFilter,
} from '#components/project/project-filter-bar'
import { ProjectGanttView } from '#components/project/project-gantt-view'
import type { ProjectView } from '#components/project/project-view-tabs'
import { FloatingActionButton } from '#components/task/create-task-inline'
import { CreateTaskModal } from '#components/task/create-task-modal'
import { TaskListColumnHeader } from '#components/task/task-list-column-header'
import { TaskTreeList } from '#components/task/task-tree-list'
import { BackHeaderBar } from '#components/ui/back-header-bar'
import { FullPageLoading } from '#components/ui/full-page-loading'
import { FullPageMessage } from '#components/ui/full-page-message'
import { useProject, useProjectTasks } from '#hooks/use-projects'
import { useTaskAgentSessionsByTaskId } from '#hooks/use-task-agent-sessions'
import { useTaskList } from '#hooks/use-tasks'
import { buildTree } from '#lib/tree-builder'

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

  // Skipped when the gantt view is active: it renders from the unfiltered
  // `tasks` above, and this filtered query would otherwise fire a request
  // whose result never gets used.
  const { isLoading: isFilteredTasksLoading, categorized } = useTaskList(
    {
      projectId,
      ...(statusFilter === 'all' ? {} : { status: statusFilter }),
      ...(sortOption === 'manual' ? {} : { sortBy: sortOption }),
    },
    { enabled: view === 'list' },
  )
  const filteredTree = useMemo(
    () => buildTree(categorized.all),
    [categorized.all],
  )
  const sessionsByTaskId = useTaskAgentSessionsByTaskId().data ?? new Map()

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
      <BackHeaderBar to="/projects/$projectId" params={{ projectId }}>
        Back
      </BackHeaderBar>

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
          <TaskListColumnHeader />
          <TaskTreeList
            isLoading={isFilteredTasksLoading}
            tree={filteredTree}
            tasks={categorized.all}
            sessionsByTaskId={sessionsByTaskId}
          />
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
