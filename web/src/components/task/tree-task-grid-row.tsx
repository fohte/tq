import { Link } from '@tanstack/react-router'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'

import { GithubLinkBadge } from '#components/task/github-link-badge'
import {
  GridEstimate,
  gridRowTitleClassName,
  gridRowWrapperClassName,
} from '#components/task/task-grid-row'
import {
  ContextBadge,
  DueDateBadge,
  TagTokens,
  TaskNumberLabel,
  useHandleStatusChange,
} from '#components/task/task-row-shared'
import { TaskStatusPicker } from '#components/task/task-status-picker'
import type { TreeNode } from '#hooks/use-tasks'

export function TreeTaskGridRow({
  node,
  depth = 0,
  defaultExpanded = true,
}: {
  node: TreeNode
  depth?: number
  defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const handleStatusChange = useHandleStatusChange(node.id, node.status)
  const hasChildren = node.children.length > 0
  const isInProgress = node.status === 'in_progress'
  const isCompleted = node.status === 'completed'

  const handleExpand = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setExpanded(!expanded)
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
          className={gridRowWrapperClassName(isInProgress, isCompleted)}
          style={{ paddingLeft: `${String(12 + depth * 14)}px` }}
        >
          {/* Desktop: single-row grid matching the column header */}
          <div className="hidden grid-cols-[26px_26px_1fr_132px_104px_72px_56px] items-center gap-2 md:grid">
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
          </div>
        </div>
      </Link>

      {/* Children */}
      {hasChildren && expanded && (
        <div data-testid="tree-children">
          {node.children.map((child) => (
            <TreeTaskGridRow
              key={child.id}
              node={child}
              depth={depth + 1}
              defaultExpanded={defaultExpanded}
            />
          ))}
        </div>
      )}
    </>
  )
}
