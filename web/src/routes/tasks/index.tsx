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
import { ListAreaMessage } from '#components/ui/list-area-message'
import { ScreenHeaderBar } from '#components/ui/screen-header-bar'
import { SectionHeading } from '#components/ui/section-heading'
import { useFilteredTaskTree } from '#hooks/use-filtered-tasks'
import { useNewTaskShortcutListener } from '#hooks/use-new-task-shortcut'
import { useProjects } from '#hooks/use-projects'
import type { TaskSortBy } from '#hooks/use-tasks'
import { useTreeOutliner } from '#hooks/use-tree-outliner'

const tasksSearchDefaults = {
  sortBy: 'updated' as TaskSortBy,
  showCompleted: false,
}

interface TasksSearch {
  sortBy?: TaskSortBy
  showCompleted?: boolean
  projectId?: string
}

function validateSearch(search: Record<string, unknown>): TasksSearch {
  const sortBy: TaskSortBy =
    sortOptionValues.find((value) => value === search['sortBy']) ?? 'updated'
  const showCompleted = search['showCompleted'] === true
  const projectId =
    typeof search['projectId'] === 'string' ? search['projectId'] : undefined
  return {
    sortBy,
    showCompleted,
    ...(projectId != null ? { projectId } : {}),
  }
}

export const Route = createFileRoute('/tasks/')({
  validateSearch,
  search: {
    middlewares: [stripSearchParams(tasksSearchDefaults)],
  },
  component: TaskList,
})

export function TaskList() {
  const {
    sortBy = 'updated',
    showCompleted = false,
    projectId,
  } = Route.useSearch()
  const navigate = Route.useNavigate()
  const [isCreating, setIsCreating] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isGithubModalOpen, setIsGithubModalOpen] = useState(false)

  const setSortBy = (sort: TaskSortBy) => {
    void navigate({
      search: (prev) => ({ ...prev, sortBy: sort }),
      replace: true,
    })
  }
  const setShowCompleted = (checked: boolean) => {
    void navigate({
      search: (prev) => ({ ...prev, showCompleted: checked }),
      replace: true,
    })
  }
  const setProjectId = (id: string) => {
    void navigate({
      search: (prev) => {
        if (id === '') {
          const { projectId: _projectId, ...rest } = prev
          void _projectId
          return rest
        }
        return { ...prev, projectId: id }
      },
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
          <ListAreaMessage>Loading...</ListAreaMessage>
        ) : isEmpty ? (
          <ListAreaMessage>No tasks yet</ListAreaMessage>
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
