import { useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useCallback, useState } from 'react'

import { DeleteTaskDialog } from '#components/task/delete-task-dialog'
import { LinkExistingTaskMenu } from '#components/task/link-existing-task-menu'
import { MoveUnderTaskMenu } from '#components/task/move-under-task-menu'
import { SetProjectMenu } from '#components/task/set-project-menu'
import { TaskRowAppearance } from '#components/task/task-row-appearance'
import { TreeRowActionsMenu } from '#components/task/tree-row-actions-menu'
import type { TaskAgentSession } from '#hooks/use-task-agent-sessions'
import type { TreeNode } from '#hooks/use-tasks'

// Module-level so the default has a stable reference across renders when a
// caller (tests, stories) doesn't pass invalidDropIds.
const EMPTY_INVALID_DROP_IDS: ReadonlySet<string> = new Set()

export interface TreeTaskGridRowProps {
  node: TreeNode
  hasChildren: boolean
  depth?: number
  sessionsByTaskId: ReadonlyMap<string, TaskAgentSession[]>
  isExpanded: (id: string) => boolean
  onToggleExpand: (id: string) => void
  selectedRowId: string | null
  onSelectRow: (id: string) => void
  onOpenChildInput: (rowId: string) => void
  invalidDropIds?: ReadonlySet<string>
}

export function TreeTaskGridRow({
  node,
  hasChildren,
  depth = 0,
  sessionsByTaskId,
  isExpanded,
  onToggleExpand,
  selectedRowId,
  onSelectRow,
  onOpenChildInput,
  invalidDropIds = EMPTY_INVALID_DROP_IDS,
}: TreeTaskGridRowProps) {
  const [linkMenuOpen, setLinkMenuOpen] = useState(false)
  const [moveMenuOpen, setMoveMenuOpen] = useState(false)
  const [projectMenuOpen, setProjectMenuOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef: setDraggableRef,
    transform,
    isDragging,
  } = useDraggable({ id: node.id, data: { node, depth } })
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: node.id,
    data: { node, depth },
    disabled: invalidDropIds.has(node.id),
  })
  const setDragDropRef = useCallback(
    (element: HTMLDivElement | null) => {
      setDraggableRef(element)
      setDroppableRef(element)
    },
    [setDraggableRef, setDroppableRef],
  )
  const dragStyle = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  }

  const sessions = sessionsByTaskId.get(node.id) ?? []
  const expanded = isExpanded(node.id)
  const isSelected = selectedRowId === node.id

  const handleExpand = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onToggleExpand(node.id)
  }

  const handleSelectRow = () => {
    onSelectRow(node.id)
  }

  const handleAddSubtask = () => {
    onOpenChildInput(node.id)
  }

  const expandToggle = hasChildren ? (
    <button
      type="button"
      onClick={handleExpand}
      data-no-dnd=""
      className="flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
      aria-label={expanded ? 'Collapse' : 'Expand'}
    >
      {expanded ? (
        <ChevronDown className="h-3.5 w-3.5" />
      ) : (
        <ChevronRight className="h-3.5 w-3.5" />
      )}
    </button>
  ) : (
    <span className="w-5 shrink-0" />
  )

  return (
    <>
      <div
        ref={setDragDropRef}
        style={dragStyle}
        {...attributes}
        {...listeners}
      >
        <TaskRowAppearance
          task={node}
          sessions={sessions}
          depth={depth}
          selected={isSelected || isOver}
          leading={expandToggle}
          trailing={
            <TreeRowActionsMenu
              onAddSubtask={handleAddSubtask}
              onLinkExisting={() => {
                setLinkMenuOpen(true)
              }}
              onMoveUnder={() => {
                setMoveMenuOpen(true)
              }}
              onSetProject={() => {
                setProjectMenuOpen(true)
              }}
              onDelete={() => {
                setDeleteDialogOpen(true)
              }}
            />
          }
          onClick={handleSelectRow}
        />
      </div>

      <LinkExistingTaskMenu
        open={linkMenuOpen}
        onOpenChange={setLinkMenuOpen}
        parentId={node.id}
        parentNumber={node.number}
      />
      <MoveUnderTaskMenu
        open={moveMenuOpen}
        onOpenChange={setMoveMenuOpen}
        taskId={node.id}
        taskNumber={node.number}
      />
      <SetProjectMenu
        open={projectMenuOpen}
        onOpenChange={setProjectMenuOpen}
        taskId={node.id}
        taskNumber={node.number}
      />
      <DeleteTaskDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        taskId={node.id}
        taskNumber={node.number}
        taskTitle={node.title}
        taskHasParent={node.parentId != null}
      />
    </>
  )
}
