import { Link } from '@tanstack/react-router'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'

import { GithubLinkBadge } from '#components/task/github-link-badge'
import { LinkExistingTaskMenu } from '#components/task/link-existing-task-menu'
import { MoveUnderTaskMenu } from '#components/task/move-under-task-menu'
import { SetProjectMenu } from '#components/task/set-project-menu'
import {
  ContextBadge,
  DueDateBadge,
  GridEstimate,
  gridRowTitleClassName,
  gridRowWrapperClassName,
  TagTokens,
  TaskNumberLabel,
  useHandleStatusChange,
} from '#components/task/task-row-shared'
import { TaskStatusPicker } from '#components/task/task-status-picker'
import { TreeOutlinerInputRow } from '#components/task/tree-outliner-input-row'
import { TreeRowActionsMenu } from '#components/task/tree-row-actions-menu'
import type { TreeNode } from '#hooks/use-tasks'
import type {
  OutlinerInput,
  ResolvedOutlinerInput,
} from '#hooks/use-tree-outliner'
import { cn } from '#lib/utils'

export interface TreeTaskGridRowProps {
  node: TreeNode
  depth?: number
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
}

export function TreeTaskGridRow({
  node,
  depth = 0,
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
}: TreeTaskGridRowProps) {
  const [linkMenuOpen, setLinkMenuOpen] = useState(false)
  const [moveMenuOpen, setMoveMenuOpen] = useState(false)
  const [projectMenuOpen, setProjectMenuOpen] = useState(false)

  const handleStatusChange = useHandleStatusChange(node.id, node.status)
  const hasChildren = node.children.length > 0
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
      <Link to="/tasks/$taskId" params={{ taskId: node.id }} className="block">
        <div
          className={cn(
            'group',
            gridRowWrapperClassName(isInProgress, isCompleted),
            isSelected && 'ring-1 ring-inset ring-border-strong',
          )}
          style={{ paddingLeft: `${String(12 + depth * 14)}px` }}
        >
          {/* Desktop: single-row grid matching the column header */}
          <div
            className="hidden grid-cols-(--task-row-columns) items-center gap-2 md:grid"
            onClick={handleSelectRow}
          >
            {expandToggle}
            <TaskStatusPicker
              status={node.status}
              onStatusChange={handleStatusChange}
            />

            <div className="flex min-w-0 items-center gap-2 overflow-hidden">
              <TaskNumberLabel number={node.number} />
              <span
                className={gridRowTitleClassName(isInProgress, isCompleted)}
              >
                {node.title}
              </span>
              <ContextBadge context={node.context} />
              {node.childCompletionCount.total > 0 && (
                <span
                  className="shrink-0 font-mono text-xs text-muted-foreground"
                  data-testid="child-completion"
                >
                  {node.childCompletionCount.completed}/
                  {node.childCompletionCount.total}
                </span>
              )}
            </div>

            <div className="overflow-hidden">
              {node.labels.length > 0 && (
                <TagTokens labels={node.labels} isCompleted={isCompleted} />
              )}
            </div>

            <div>
              {node.githubLink != null && (
                <GithubLinkBadge link={node.githubLink} />
              )}
            </div>

            <div>
              {node.estimatedMinutes != null && (
                <GridEstimate
                  estimatedMinutes={node.estimatedMinutes}
                  isCompleted={isCompleted}
                />
              )}
            </div>

            <div className="text-right">
              {node.dueDate != null && (
                <DueDateBadge dueDate={node.dueDate} status={node.status} />
              )}
            </div>

            {/* Fragment: TreeRowActionsMenu renders two sibling triggers
                (desktop dropdown + mobile action sheet), so it needs a
                single wrapping element here to occupy exactly one grid
                cell. */}
            <div>
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
              />
            </div>
          </div>

          {/* Mobile: two-line stack */}
          <div className="flex items-start gap-2 md:hidden">
            {expandToggle}
            <TaskStatusPicker
              status={node.status}
              onStatusChange={handleStatusChange}
            />

            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span
                className={gridRowTitleClassName(isInProgress, isCompleted)}
              >
                {node.title}
              </span>
              <div className="flex items-center gap-1.5 overflow-hidden">
                <TaskNumberLabel number={node.number} />
                <ContextBadge context={node.context} />
                {node.childCompletionCount.total > 0 && (
                  <span
                    className="shrink-0 font-mono text-xs text-muted-foreground"
                    data-testid="child-completion"
                  >
                    {node.childCompletionCount.completed}/
                    {node.childCompletionCount.total}
                  </span>
                )}
                {node.labels.length > 0 && (
                  <TagTokens labels={node.labels} isCompleted={isCompleted} />
                )}
                <div className="ml-auto flex shrink-0 items-center gap-1.5">
                  {node.dueDate != null && (
                    <DueDateBadge dueDate={node.dueDate} status={node.status} />
                  )}
                  {node.estimatedMinutes != null && (
                    <GridEstimate
                      estimatedMinutes={node.estimatedMinutes}
                      isCompleted={isCompleted}
                    />
                  )}
                </div>
              </div>
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
              />
            </div>
          </div>
        </div>
      </Link>

      {/* Children (plus a forced-visible slot for a 'child' outliner input,
          even on an otherwise-collapsed or childless node) */}
      {(attachChildInputHere || (hasChildren && expanded)) && (
        <div data-testid="tree-children">
          {node.children.map((child) => (
            <TreeTaskGridRow
              key={child.id}
              node={child}
              depth={depth + 1}
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
    </>
  )
}
