import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { buildSearchQuery, parseSearchQuery } from 'api/search-query-parser'
import { useCallback, useState } from 'react'

import {
  CreateTaskInline,
  FloatingActionButton,
} from '#components/task/create-task-inline'
import { CreateTaskModal } from '#components/task/create-task-modal'
import { GithubIssueLinkModal } from '#components/task/github-issue-link-modal'
import { TaskFilterChipRow } from '#components/task/task-filter-chip-row'
import { TaskListColumnHeader } from '#components/task/task-list-column-header'
import { TaskListToolbar } from '#components/task/task-list-toolbar'
import { TaskTreeList } from '#components/task/task-tree-list'
import { ScreenHeaderBar } from '#components/ui/screen-header-bar'
import { SectionHeading } from '#components/ui/section-heading'
import { useFilteredTaskTree } from '#hooks/use-filtered-tasks'
import { useNewTaskShortcutListener } from '#hooks/use-new-task-shortcut'
import { useProjects } from '#hooks/use-projects'
import { useTaskAgentSessionsByTaskId } from '#hooks/use-task-agent-sessions'
import { sortOptionValues } from '#lib/tasks-query'

const tasksSearchDefaults = {
  q: buildSearchQuery({
    freeText: '',
    status: ['todo', 'in_progress'],
    sortBy: 'updated',
  }),
}

interface TasksSearch {
  q?: string
}

function validateSearch(search: Record<string, unknown>): TasksSearch {
  const rawQ = typeof search['q'] === 'string' ? search['q'] : undefined
  if (rawQ != null && rawQ !== '') return { q: rawQ }

  // Migrate URLs bookmarked/shared before the sortBy/showCompleted/projectId/tag
  // -> q migration, instead of silently discarding their filter.
  if (
    'sortBy' in search ||
    'showCompleted' in search ||
    'projectId' in search ||
    'tag' in search
  ) {
    const sortBy =
      sortOptionValues.find((value) => value === search['sortBy']) ?? 'updated'
    const showCompleted = search['showCompleted'] === true
    const projectId =
      typeof search['projectId'] === 'string' ? search['projectId'] : undefined
    const tag = typeof search['tag'] === 'string' ? search['tag'] : undefined
    return {
      q: buildSearchQuery({
        freeText: '',
        ...(showCompleted ? {} : { status: ['todo', 'in_progress'] }),
        sortBy,
        ...(projectId != null ? { projectId } : {}),
        ...(tag != null ? { label: tag } : {}),
      }),
    }
  }

  return { q: tasksSearchDefaults.q }
}

export const Route = createFileRoute('/tasks/')({
  validateSearch,
  search: {
    middlewares: [stripSearchParams(tasksSearchDefaults)],
  },
  component: TaskList,
})

export function TaskList() {
  const { q = tasksSearchDefaults.q } = Route.useSearch()
  const parsed = parseSearchQuery(q)
  const navigate = Route.useNavigate()
  const [isCreating, setIsCreating] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isGithubModalOpen, setIsGithubModalOpen] = useState(false)

  const setQuery = (newQuery: string) => {
    void navigate({
      search: (prev) => ({ ...prev, q: newQuery }),
      replace: true,
    })
  }

  const projects = useProjects()

  const {
    isLoading,
    tree: filteredTreeData,
    tasks,
  } = useFilteredTaskTree({ q })
  const sessionsByTaskId = useTaskAgentSessionsByTaskId().data ?? new Map()

  useNewTaskShortcutListener(
    useCallback(() => {
      setIsCreating(true)
    }, []),
  )

  return (
    <div className="flex h-full flex-col">
      <ScreenHeaderBar>
        <SectionHeading level={2}>tasks</SectionHeading>
        <TaskListToolbar
          onCreateFromGithub={() => {
            setIsGithubModalOpen(true)
          }}
          onCreateNew={() => {
            setIsCreating(true)
          }}
        />
      </ScreenHeaderBar>

      <TaskFilterChipRow
        onQueryChange={setQuery}
        parsed={parsed}
        projects={projects.data ?? []}
      />

      {/* Inline create */}
      {isCreating && (
        <div className="border-b border-border">
          <CreateTaskInline
            onClose={() => {
              setIsCreating(false)
            }}
          />
        </div>
      )}

      <TaskListColumnHeader />

      <TaskTreeList
        isLoading={isLoading}
        tree={filteredTreeData}
        tasks={tasks}
        sessionsByTaskId={sessionsByTaskId}
      />

      {/* FAB (mobile only) */}
      <FloatingActionButton
        onClick={() => {
          setIsModalOpen(true)
        }}
      />

      {/* Task create modal */}
      <CreateTaskModal open={isModalOpen} onOpenChange={setIsModalOpen} />

      {/* Create task from GitHub issue/PR modal */}
      <GithubIssueLinkModal
        open={isGithubModalOpen}
        onOpenChange={setIsGithubModalOpen}
        mode="create"
      />
    </div>
  )
}
