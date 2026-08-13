import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { useCallback, useState } from 'react'

import { ContextFilterInline } from '#components/context-filter'
import { TagFilterBar } from '#components/tag-filter-bar'
import { TagFilterChips } from '#components/tag-filter-chips'
import {
  CreateTaskInline,
  FloatingActionButton,
} from '#components/task/create-task-inline'
import { CreateTaskModal } from '#components/task/create-task-modal'
import { GithubIssueLinkModal } from '#components/task/github-issue-link-modal'
import { TaskListColumnHeader } from '#components/task/task-list-column-header'
import {
  sortOptionValues,
  TaskListToolbar,
} from '#components/task/task-list-toolbar'
import { TreeTaskGridRow } from '#components/task/tree-task-grid-row'
import { ScreenHeaderBar } from '#components/ui/screen-header-bar'
import { SectionHeading } from '#components/ui/section-heading'
import { useFilteredTaskTree } from '#hooks/use-filtered-tasks'
import { useNewTaskShortcutListener } from '#hooks/use-new-task-shortcut'
import { useProjects } from '#hooks/use-projects'
import type { TaskSortBy } from '#hooks/use-tasks'
import { useTreeOutliner } from '#hooks/use-tree-outliner'

interface TasksFilterState {
  sortBy: TaskSortBy
  showCompleted: boolean
  projectId: string | undefined
}

// Mirrors the API's search-query-parser vocabulary (`is:` / `sort:` /
// `project:`) so a `q` built here means the same thing server-side.
function buildTasksQuery(state: TasksFilterState): string {
  const parts: string[] = []
  if (!state.showCompleted) parts.push('is:todo', 'is:in_progress')
  // Always included, even for the default 'updated': the API falls back to
  // sorting by `created` when no sort is specified at all.
  parts.push(`sort:${state.sortBy}`)
  if (state.projectId != null) parts.push(`project:${state.projectId}`)
  return parts.join(' ')
}

function parseTasksQuery(q: string): TasksFilterState {
  let sortBy: TaskSortBy = 'updated'
  let showCompleted = true
  let projectId: string | undefined
  for (const token of q.split(/\s+/).filter((t) => t !== '')) {
    if (token === 'is:todo' || token === 'is:in_progress') {
      showCompleted = false
    } else if (token.startsWith('sort:')) {
      const value = token.slice('sort:'.length)
      const matched = sortOptionValues.find((v) => v === value)
      if (matched != null) sortBy = matched
    } else if (token.startsWith('project:')) {
      const value = token.slice('project:'.length)
      if (value !== '') projectId = value
    }
  }
  return { sortBy, showCompleted, projectId }
}

const tasksSearchDefaults = {
  q: buildTasksQuery({
    sortBy: 'updated',
    showCompleted: false,
    projectId: undefined,
  }),
}

interface TasksSearch {
  q?: string
}

function validateSearch(search: Record<string, unknown>): TasksSearch {
  const q =
    typeof search['q'] === 'string' ? search['q'] : tasksSearchDefaults.q
  return { q }
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
  const { sortBy, showCompleted, projectId } = parseTasksQuery(q)
  const navigate = Route.useNavigate()
  const [isCreating, setIsCreating] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isGithubModalOpen, setIsGithubModalOpen] = useState(false)

  const setSortBy = (sort: TaskSortBy) => {
    void navigate({
      search: (prev) => ({
        ...prev,
        q: buildTasksQuery({ sortBy: sort, showCompleted, projectId }),
      }),
      replace: true,
    })
  }
  const setShowCompleted = (checked: boolean) => {
    void navigate({
      search: (prev) => ({
        ...prev,
        q: buildTasksQuery({ sortBy, showCompleted: checked, projectId }),
      }),
      replace: true,
    })
  }
  const setProjectId = (id: string) => {
    void navigate({
      search: (prev) => ({
        ...prev,
        q: buildTasksQuery({
          sortBy,
          showCompleted,
          projectId: id === '' ? undefined : id,
        }),
      }),
      replace: true,
    })
  }

  const projects = useProjects()

  const { isLoading, tree: filteredTreeData } = useFilteredTaskTree({
    sortBy,
    showCompleted,
    projectId,
  })
  const treeOutliner = useTreeOutliner(filteredTreeData, { enabled: true })

  useNewTaskShortcutListener(
    useCallback(() => {
      setIsCreating(true)
    }, []),
  )

  const isEmpty = filteredTreeData.length === 0

  return (
    <div className="flex h-full flex-col">
      <ScreenHeaderBar>
        <SectionHeading level={2}>tasks</SectionHeading>
        <TaskListToolbar
          showCompleted={showCompleted}
          onShowCompletedChange={setShowCompleted}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          projects={projects.data ?? []}
          projectId={projectId}
          onProjectIdChange={setProjectId}
          onCreateFromGithub={() => {
            setIsGithubModalOpen(true)
          }}
          onCreateNew={() => {
            setIsCreating(true)
          }}
        />
      </ScreenHeaderBar>

      <TagFilterBar />

      {/* Context filter (mobile only — desktop already has it in the sidebar) */}
      <div className="border-b border-border px-3 py-2 md:hidden">
        <ContextFilterInline />
      </div>

      {/* Tag filter chips (mobile only — desktop already has TAGS in the sidebar) */}
      <div className="md:hidden">
        <TagFilterChips />
      </div>

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

      {/* Task list */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Loading...
          </div>
        ) : isEmpty ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No tasks yet
          </div>
        ) : (
          <div className="py-1" data-testid="task-tree">
            {filteredTreeData.map((node) => (
              <TreeTaskGridRow
                key={node.id}
                node={node}
                isExpanded={treeOutliner.isExpanded}
                onToggleExpand={treeOutliner.toggleExpand}
                selectedRowId={treeOutliner.selectedRowId}
                onSelectRow={treeOutliner.selectRow}
                outlinerInput={treeOutliner.outlinerInput}
                outlinerTarget={treeOutliner.outlinerTarget}
                onOpenChildInput={treeOutliner.openChildInput}
                onCloseOutlinerInput={treeOutliner.closeOutlinerInput}
                onIndentOutlinerInput={treeOutliner.indentOutlinerInput}
                onOutdentOutlinerInput={treeOutliner.outdentOutlinerInput}
              />
            ))}
          </div>
        )}
      </div>

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
