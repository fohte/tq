import { useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Link } from '@tanstack/react-router'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useCallback, useState } from 'react'

import { SessionIndicator } from '#components/agent-session/session-indicator'
import { DeleteTaskDialog } from '#components/task/delete-task-dialog'
import { GithubLinkBadge } from '#components/task/github-link-badge'
import { LinkExistingTaskMenu } from '#components/task/link-existing-task-menu'
import { MoveUnderTaskMenu } from '#components/task/move-under-task-menu'
import { SetProjectMenu } from '#components/task/set-project-menu'
import {
  ROW_INDENT_CLASS_NAME,
  rowIndentStyle,
  rowTitleClassName,
  rowWrapperClassName,
  StartDateBadge,
  TagTokens,
  TaskNumberLabel,
  TaskProjectLabel,
  useHandleStatusChange,
} from '#components/task/task-row-shared'
import { TaskStatusPicker } from '#components/task/task-status-picker'
import { TreeOutlinerInputRow } from '#components/task/tree-outliner-input-row'
import { TreeRowActionsMenu } from '#components/task/tree-row-actions-menu'
import type { TaskAgentSession } from '#hooks/use-task-agent-sessions'
import type { TreeNode } from '#hooks/use-tasks'
import type {
  OutlinerInput,
  ResolvedOutlinerInput,
} from '#hooks/use-tree-outliner'
import { cn } from '#lib/utils'

// Module-level so the default has a stable reference across renders when a
// caller (tests, stories) doesn't pass invalidDropIds.
const EMPTY_INVALID_DROP_IDS: ReadonlySet<string> = new Set()

export interface TreeTaskGridRowProps {
  node: TreeNode
  depth?: number
  sessionsByTaskId: ReadonlyMap<string, TaskAgentSession[]>
  isExpanded: (id: string) => boolean
  onToggleExpand: (id: string) => void
  selectedRowId: string | null
  onSelectRow: (id: string) => void
  outlinerInput: OutlinerInput | null
  outlinerTarget: ResolvedOutlinerInput | null
  onOpenChildInput: (rowId: string) => void
  onCloseOutlinerInput: () => void
  onIndentOutlinerInput: () => void
  onOutdentOutlinerInput: () => void
  invalidDropIds?: ReadonlySet<string>
}

export function TreeTaskGridRow({
  node,
  depth = 0,
  sessionsByTaskId,
  isExpanded,
  onToggleExpand,
  selectedRowId,
  onSelectRow,
  outlinerInput,
  outlinerTarget,
  onOpenChildInput,
  onCloseOutlinerInput,
  onIndentOutlinerInput,
  onOutdentOutlinerInput,
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

  const handleStatusChange = useHandleStatusChange(node.id, node.status)
  const hasChildren = node.children.length > 0
  const sessions = sessionsByTaskId.get(node.id) ?? []
  const expanded = isExpanded(node.id)
  const isInProgress = node.status === 'in_progress'
  const isCompleted = node.status === 'completed'
  const isSelected = selectedRowId === node.id

  // The outliner input is attached to whichever row's id matches
  // `anchorRowId` — as a forced-visible extra child (mode: 'child') or as a
  // sibling rendered right after this row's own block (mode: 'sibling').
  // Its visual depth tracks `outlinerTarget.depth`, not this row's own
  // `depth`, so Tab/Shift-Tab re-indent it without moving its position.
  const attachChildInputHere =
    outlinerInput?.mode === 'child' && outlinerInput.anchorRowId === node.id
  const attachSiblingInputAfter =
    outlinerInput?.mode === 'sibling' && outlinerInput.anchorRowId === node.id

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

  const hasSecondLine =
    node.labels.length > 0 || node.startDate != null || node.githubLink != null

  return (
    <>
      <div
        ref={setDragDropRef}
        style={dragStyle}
        {...attributes}
        {...listeners}
      >
        <Link
          to="/tasks/$taskId"
          params={{ taskId: node.id }}
          className="block"
        >
          <div
            className={cn(
              'group',
              rowWrapperClassName(isInProgress, isCompleted),
              // Must come after rowWrapperClassName: twMerge keeps
              // both px-* and a later pl-* (CSS cascade lets pl-* win),
              // but drops pl-* if it precedes the conflicting px-*.
              ROW_INDENT_CLASS_NAME,
              (isSelected || isOver) && 'ring-1 ring-inset ring-border-strong',
            )}
            style={rowIndentStyle(depth)}
          >
            <div className="flex items-start gap-2" onClick={handleSelectRow}>
              {expandToggle}
              {/* Placed next to the expand toggle, not the title: whether
                this badge exists is the same fact as whether the toggle
                does (both hinge on hasChildren), so they read as one unit. */}
              {node.childCompletionCount.total > 0 && (
                <span
                  className="shrink-0 self-center font-mono text-xs text-muted-foreground"
                  data-testid="child-completion"
                >
                  {node.childCompletionCount.completed}/
                  {node.childCompletionCount.total}
                </span>
              )}
              <TaskStatusPicker
                status={node.status}
                onStatusChange={handleStatusChange}
              />

              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center gap-2 overflow-hidden">
                  <TaskNumberLabel number={node.number} />
                  {/* min-w-30 (120px): without a floor, this flex item's
                    default min-width would shrink to 0 once its siblings
                    need more room than the row has, hiding the title
                    entirely instead of truncating it or letting the row
                    overflow. No flex-1: the title (and its siblings below)
                    should stay only as wide as their content and leave
                    unused space at the row's right edge, not stretch into
                    it. */}
                  <span
                    className={cn(
                      rowTitleClassName(isInProgress, isCompleted),
                      'min-w-30',
                    )}
                  >
                    {node.title}
                  </span>
                  {node.projectId != null && (
                    <TaskProjectLabel projectId={node.projectId} />
                  )}
                  <SessionIndicator sessions={sessions} />
                </div>

                {hasSecondLine && (
                  <div className="flex items-center gap-2 overflow-hidden">
                    {node.labels.length > 0 && (
                      <TagTokens
                        labels={node.labels}
                        isCompleted={isCompleted}
                      />
                    )}
                    {node.startDate != null && (
                      <StartDateBadge startDate={node.startDate} />
                    )}
                    {node.githubLink != null && (
                      <GithubLinkBadge link={node.githubLink} />
                    )}
                  </div>
                )}
              </div>

              <div className="shrink-0 self-center">
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
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* Children (plus a forced-visible slot for a 'child' outliner input,
          even on an otherwise-collapsed or childless node) */}
      {(attachChildInputHere || (hasChildren && expanded)) && (
        <div data-testid="tree-children">
          {node.children.map((child) => (
            <TreeTaskGridRow
              key={child.id}
              node={child}
              depth={depth + 1}
              sessionsByTaskId={sessionsByTaskId}
              isExpanded={isExpanded}
              onToggleExpand={onToggleExpand}
              selectedRowId={selectedRowId}
              onSelectRow={onSelectRow}
              outlinerInput={outlinerInput}
              outlinerTarget={outlinerTarget}
              onOpenChildInput={onOpenChildInput}
              onCloseOutlinerInput={onCloseOutlinerInput}
              onIndentOutlinerInput={onIndentOutlinerInput}
              onOutdentOutlinerInput={onOutdentOutlinerInput}
              invalidDropIds={invalidDropIds}
            />
          ))}
          {attachChildInputHere && outlinerTarget && (
            <TreeOutlinerInputRow
              depth={outlinerTarget.depth}
              parentId={outlinerTarget.parentId}
              parentNumber={outlinerTarget.parentNumber}
              inherited={outlinerTarget.inherited}
              onClose={onCloseOutlinerInput}
              onIndent={onIndentOutlinerInput}
              onOutdent={onOutdentOutlinerInput}
            />
          )}
        </div>
      )}

      {attachSiblingInputAfter && outlinerTarget && (
        <TreeOutlinerInputRow
          depth={outlinerTarget.depth}
          parentId={outlinerTarget.parentId}
          parentNumber={outlinerTarget.parentNumber}
          inherited={outlinerTarget.inherited}
          onClose={onCloseOutlinerInput}
          onIndent={onIndentOutlinerInput}
          onOutdent={onOutdentOutlinerInput}
        />
      )}

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
