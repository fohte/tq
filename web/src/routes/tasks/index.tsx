import {
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { useCallback, useMemo, useState } from 'react'

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
import type { DropTarget } from '#components/task/tree-drag-overlay-content'
import { TreeDragOverlayContent } from '#components/task/tree-drag-overlay-content'
import { TreeTaskGridRow } from '#components/task/tree-task-grid-row'
import { ScreenHeaderBar } from '#components/ui/screen-header-bar'
import { SectionHeading } from '#components/ui/section-heading'
import { useFilteredTaskTree } from '#hooks/use-filtered-tasks'
import { useNewTaskShortcutListener } from '#hooks/use-new-task-shortcut'
import { useProjects } from '#hooks/use-projects'
import type { TaskSortBy, TreeNode } from '#hooks/use-tasks'
import { useUpdateTaskParent } from '#hooks/use-tasks'
import { useTreeOutliner } from '#hooks/use-tree-outliner'
import { computeDropMode, getDescendantIds } from '#lib/task-tree'

interface TreeRowDragData extends Record<string, unknown> {
  node: TreeNode
  depth: number
}

function isTreeRowDragData(
  data: Record<string, unknown> | undefined,
): data is TreeRowDragData {
  return data != null && typeof data['depth'] === 'number'
}

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

  const {
    isLoading,
    tree: filteredTreeData,
    tasks,
  } = useFilteredTaskTree({
    sortBy,
    showCompleted,
    projectId,
  })
  const treeOutliner = useTreeOutliner(filteredTreeData, { enabled: true })
  const updateTaskParent = useUpdateTaskParent()

  const [activeNode, setActiveNode] = useState<TreeNode | null>(null)
  const [activeWidth, setActiveWidth] = useState<number | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)

  // Desktop uses MouseSensor and mobile uses TouchSensor (rather than the
  // unified PointerSensor) so each can have its own activationConstraint: a
  // short tap must still navigate via the row's <Link>, so touch needs a
  // ~250ms hold before a drag starts, while desktop just needs to rule out
  // an accidental click-and-jitter.
  const dndSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
  )

  // A task can't be dropped onto itself or any of its own descendants —
  // each row's own useDroppable disables itself for these ids so `over`
  // can never resolve to an invalid target.
  const invalidDropIds = useMemo(
    () =>
      activeNode == null
        ? new Set<string>()
        : new Set([activeNode.id, ...getDescendantIds(tasks, activeNode.id)]),
    [activeNode, tasks],
  )

  const resetDragState = () => {
    setActiveNode(null)
    setActiveWidth(null)
    setDropTarget(null)
  }

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current
    setActiveNode(isTreeRowDragData(data) ? data.node : null)
    // DragOverlay doesn't auto-size to the source row, so its width is
    // captured once here and held for the duration of the drag.
    setActiveWidth(event.active.rect.current.initial?.width ?? null)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const overData = event.over?.data.current
    if (event.over == null || !isTreeRowDragData(overData)) {
      setDropTarget(null)
      return
    }
    const mode = computeDropMode(
      event.over.rect,
      event.active.rect.current.translated,
    )
    setDropTarget({ node: overData.node, depth: overData.depth, mode })
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const overData = event.over?.data.current
    const activeData = event.active.data.current
    if (
      event.over != null &&
      isTreeRowDragData(overData) &&
      isTreeRowDragData(activeData)
    ) {
      const mode = computeDropMode(
        event.over.rect,
        event.active.rect.current.translated,
      )
      const newParentId =
        mode === 'child' ? overData.node.id : overData.node.parentId
      if (activeData.node.parentId !== newParentId) {
        updateTaskParent.mutate({
          id: activeData.node.id,
          parentId: newParentId,
        })
      }
    }
    resetDragState()
  }

  const handleDragCancel = () => {
    resetDragState()
  }

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
          <DndContext
            sensors={dndSensors}
            collisionDetection={pointerWithin}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
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
                  invalidDropIds={invalidDropIds}
                />
              ))}
            </div>

            <DragOverlay>
              {activeNode && (
                <div style={{ width: activeWidth ?? undefined }}>
                  <TreeDragOverlayContent
                    node={activeNode}
                    target={dropTarget}
                  />
                </div>
              )}
            </DragOverlay>
          </DndContext>
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
