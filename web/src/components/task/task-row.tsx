import { Link } from '@tanstack/react-router'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'

import { GithubLinkBadge } from '#components/task/github-link-badge'
import {
  COMPLETED_DIM_CLASS,
  ContextBadge,
  DueDateBadge,
  TagTokens,
  TaskNumberLabel,
  useHandleStatusChange,
} from '#components/task/task-row-shared'
import { TaskStatusPicker } from '#components/task/task-status-picker'
import type { GithubLink } from '#hooks/use-github-link'
import type { Task, TreeNode } from '#hooks/use-tasks'
import { formatMinutes } from '#lib/format'
import { cn } from '#lib/utils'

function rowWrapperClassName(isInProgress: boolean, isCompleted: boolean) {
  return cn(
    'flex items-center gap-2 border-b border-border border-l-2 border-l-transparent px-3 py-2',
    isInProgress && 'border-l-primary bg-card',
    isCompleted && COMPLETED_DIM_CLASS,
  )
}

function rowTitleClassName(isInProgress: boolean, isCompleted: boolean) {
  return cn(
    'truncate text-sm',
    isInProgress ? 'font-semibold' : 'font-normal',
    isCompleted && 'text-muted-foreground line-through',
  )
}

interface TaskRowBaseProps {
  id: string
  number: number
  title: string
  status: Task['status']
  context: Task['context']
  estimatedMinutes: number | null
  parentNumber: number | null
  githubLink: GithubLink | null
  labels: string[]
  dueDate: string | null
}

function TaskRowContent({
  id,
  number,
  title,
  status,
  context,
  estimatedMinutes,
  parentNumber,
  githubLink,
  labels,
  dueDate,
}: TaskRowBaseProps) {
  const handleStatusChange = useHandleStatusChange(id, status)
  const isInProgress = status === 'in_progress'
  const isCompleted = status === 'completed'

  return (
    <div className={rowWrapperClassName(isInProgress, isCompleted)}>
      <TaskStatusPicker status={status} onStatusChange={handleStatusChange} />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {/* TopRow */}
        <div className="flex items-center gap-2 overflow-hidden">
          <TaskNumberLabel number={number} />
          <span className={rowTitleClassName(isInProgress, isCompleted)}>
            {title}
          </span>
          {parentNumber != null && (
            <span className="shrink-0 font-mono text-xs text-muted-foreground">
              ← #{parentNumber}
            </span>
          )}
        </div>

        {/* BottomRow */}
        <div className="flex items-center gap-1.5">
          <ContextBadge context={context} />
          {githubLink != null && <GithubLinkBadge link={githubLink} />}
          {labels.length > 0 && (
            <TagTokens labels={labels} isCompleted={status === 'completed'} />
          )}
          {estimatedMinutes != null && (
            <span className="font-mono text-xs text-muted-foreground">
              {formatMinutes(estimatedMinutes)}
            </span>
          )}
          {dueDate != null && (
            <DueDateBadge dueDate={dueDate} status={status} />
          )}
        </div>
      </div>
    </div>
  )
}

export function TaskRow({
  task,
  draggable = false,
}: {
  task: Task
  draggable?: boolean
}) {
  return (
    <Link
      to="/tasks/$taskId"
      params={{ taskId: task.id }}
      className={cn(
        'block transition-colors hover:bg-secondary/30',
        draggable && 'cursor-grab active:cursor-grabbing',
      )}
      {...(draggable
        ? {
            'data-task-id': task.id,
            'data-task-title': task.title,
            ...(task.estimatedMinutes != null
              ? { 'data-estimated-minutes': String(task.estimatedMinutes) }
              : {}),
          }
        : {})}
    >
      <TaskRowContent
        id={task.id}
        number={task.number}
        title={task.title}
        status={task.status}
        context={task.context}
        estimatedMinutes={task.estimatedMinutes}
        parentNumber={task.parentNumber}
        githubLink={task.githubLink}
        labels={task.labels}
        dueDate={task.dueDate}
      />
    </Link>
  )
}

export function TreeTaskRow({
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

  return (
    <>
      <Link
        to="/tasks/$taskId"
        params={{ taskId: node.id }}
        className="block transition-colors hover:bg-secondary/30"
      >
        <div
          className={rowWrapperClassName(isInProgress, isCompleted)}
          style={{ paddingLeft: `${String(depth * 24 + 12)}px` }}
        >
          {/* Expand/collapse toggle */}
          {hasChildren ? (
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
          )}

          <TaskStatusPicker
            status={node.status}
            onStatusChange={handleStatusChange}
          />

          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            {/* TopRow */}
            <div className="flex items-center gap-2 overflow-hidden">
              <TaskNumberLabel number={node.number} />
              <span className={rowTitleClassName(isInProgress, isCompleted)}>
                {node.title}
              </span>
            </div>

            {/* BottomRow */}
            <div className="flex items-center gap-1.5">
              {/* Child completion count */}
              {node.childCompletionCount.total > 0 && (
                <span
                  className="font-mono text-xs text-muted-foreground"
                  data-testid="child-completion"
                >
                  {node.childCompletionCount.completed}/
                  {node.childCompletionCount.total}
                </span>
              )}
              <ContextBadge context={node.context} />
              {node.githubLink != null && (
                <GithubLinkBadge link={node.githubLink} />
              )}
              {node.labels.length > 0 && (
                <TagTokens labels={node.labels} isCompleted={isCompleted} />
              )}
              {node.estimatedMinutes != null && (
                <span className="font-mono text-xs text-muted-foreground">
                  {formatMinutes(node.estimatedMinutes)}
                </span>
              )}
              {node.dueDate != null && (
                <DueDateBadge dueDate={node.dueDate} status={node.status} />
              )}
            </div>
          </div>
        </div>
      </Link>

      {/* Children */}
      {hasChildren && expanded && (
        <div data-testid="tree-children">
          {node.children.map((child) => (
            <TreeTaskRow
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
