import {
  DndContext,
  type DragEndEvent,
  type DragMoveEvent,
  DragOverlay,
  type DragStartEvent,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { useCallback, useMemo, useState } from 'react'

import { CreateTaskModal } from '#components/task/create-task-modal'
import type { DropTarget } from '#components/task/tree-drag-overlay-content'
import { TreeDragOverlayContent } from '#components/task/tree-drag-overlay-content'
import { TreeTaskGridRow } from '#components/task/tree-task-grid-row'
import { ListAreaMessage } from '#components/ui/list-area-message'
import { useLazyTaskTree } from '#hooks/use-lazy-task-tree'
import type { TaskAgentSession } from '#hooks/use-task-agent-sessions'
import type { Task, TaskListFilter, TreeNode } from '#hooks/use-tasks'
import { useUpdateTaskParent } from '#hooks/use-tasks'
import { useTreeOutliner } from '#hooks/use-tree-outliner'
import {
  computeDropMode,
  getDescendantIds,
  resolveDropParentId,
} from '#lib/task-tree'
import { buildTreeRenderRows } from '#lib/tree-outliner'

interface TreeRowDragData extends Record<string, unknown> {
  node: TreeNode
  depth: number
}

function isTreeRowDragData(
  data: Record<string, unknown> | undefined,
): data is TreeRowDragData {
  return data != null && typeof data['depth'] === 'number'
}

// Nested interactive controls (status picker, actions menu, expand toggle)
// only stopPropagation() on click, not pointerdown/touchstart, so the
// distance/delay activation constraint below can still misfire a drag from
// pointer jitter while a user is trying to click one of them. These sensor
// subclasses skip activation when the pointer/touch originates inside an
// element marked data-no-dnd, following dnd-kit's documented pattern for
// excluding nested interactive elements from drag activation.
function shouldHandleDrag(target: EventTarget | null): boolean {
  let el = target instanceof HTMLElement ? target : null
  while (el != null) {
    if (el.dataset['noDnd'] != null) return false
    el = el.parentElement
  }
  return true
}

class TreeRowMouseSensor extends MouseSensor {
  static override activators = [
    {
      eventName: 'onMouseDown' as const,
      handler: ({ nativeEvent }: React.MouseEvent) =>
        shouldHandleDrag(nativeEvent.target),
    },
  ]
}

class TreeRowTouchSensor extends TouchSensor {
  static override activators = [
    {
      eventName: 'onTouchStart' as const,
      handler: ({ nativeEvent }: React.TouchEvent) =>
        shouldHandleDrag(nativeEvent.target),
    },
  ]
}

export interface TaskTreeListProps {
  isLoading: boolean
  tree: TreeNode[]
  tasks: Task[]
  sessionsByTaskId: ReadonlyMap<string, TaskAgentSession[]>
  /** Forwarded to useLazyTaskTree; see its docstring for behavior. */
  lazyChildrenFilter?: TaskListFilter | undefined
  /** Only set this when this list's own div is the scrolling element — TaskTreeList is also embedded non-scrolling inside project-detail-main.tsx, which scrolls via an ancestor container instead. */
  scrollRestorationId?: string
}

export function TaskTreeList({
  isLoading,
  tree: rootTree,
  tasks,
  sessionsByTaskId,
  lazyChildrenFilter,
  scrollRestorationId,
}: TaskTreeListProps) {
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createModalParent, setCreateModalParent] = useState<TreeNode | null>(
    null,
  )

  const openCreateModal = useCallback((parent: TreeNode | null) => {
    setCreateModalParent(parent)
    setCreateModalOpen(true)
  }, [])

  const { tree, isExpanded, toggleExpand, hasChildren } = useLazyTaskTree(
    rootTree,
    lazyChildrenFilter,
  )

  const treeOutliner = useTreeOutliner(tree, {
    enabled: true,
    onOpenSiblingCreate: openCreateModal,
    isExpanded,
    toggleExpand,
  })
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
    useSensor(TreeRowMouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TreeRowTouchSensor, {
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

  const renderRows = useMemo(
    () => buildTreeRenderRows(tree, { isExpanded: treeOutliner.isExpanded }),
    [tree, treeOutliner.isExpanded],
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

  // Wired to both onDragOver and onDragMove: dnd-kit only fires onDragOver
  // when the hovered droppable id changes, not on every pointer move, so
  // moving within the same row (e.g. middle band to top band) would
  // otherwise leave the child/sibling preview stale.
  const handleDragOver = (event: DragMoveEvent) => {
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
    const activeData = event.active.data.current
    if (
      event.over != null &&
      isTreeRowDragData(activeData) &&
      dropTarget != null &&
      dropTarget.node.id === event.over.id
    ) {
      const newParentId = resolveDropParentId(dropTarget.mode, dropTarget.node)
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

  const isEmpty = tree.length === 0

  return (
    <div
      className="flex-1 overflow-auto"
      data-scroll-restoration-id={scrollRestorationId}
    >
      {isLoading ? (
        <ListAreaMessage>Loading...</ListAreaMessage>
      ) : isEmpty ? (
        <ListAreaMessage>No tasks yet</ListAreaMessage>
      ) : (
        <DndContext
          sensors={dndSensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragMove={handleDragOver}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="py-1" data-testid="task-tree">
            {renderRows.map(({ node, depth }) => (
              <TreeTaskGridRow
                key={node.id}
                node={node}
                hasChildren={hasChildren(node)}
                depth={depth}
                sessionsByTaskId={sessionsByTaskId}
                isExpanded={treeOutliner.isExpanded}
                onToggleExpand={treeOutliner.toggleExpand}
                selectedRowId={treeOutliner.selectedRowId}
                onSelectRow={treeOutliner.selectRow}
                onAddSubtask={openCreateModal}
                invalidDropIds={invalidDropIds}
              />
            ))}
          </div>

          <DragOverlay>
            {activeNode && (
              <div style={{ width: activeWidth ?? undefined }}>
                <TreeDragOverlayContent node={activeNode} target={dropTarget} />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}
      <CreateTaskModal
        key={createModalParent?.id ?? 'new'}
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        {...(createModalParent != null
          ? {
              parentId: createModalParent.id,
              parentTaskNumber: createModalParent.number,
              parentTaskTitle: createModalParent.title,
              defaultContext: createModalParent.context,
              defaultLabels: createModalParent.labels,
              ...(createModalParent.projectId != null
                ? { projectId: createModalParent.projectId }
                : {}),
            }
          : {})}
      />
    </div>
  )
}
