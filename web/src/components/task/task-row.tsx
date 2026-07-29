import { Link } from '@tanstack/react-router'
import { Check, ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'

import { GithubLinkBadge } from '#components/task/github-link-badge'
import { TaskStatusPicker } from '#components/task/task-status-picker'
import type { GithubLink } from '#hooks/use-github-link'
import type { Task, TreeNode } from '#hooks/use-tasks'
import { useCompleteTask, useUpdateTaskStatus } from '#hooks/use-tasks'
import { formatMinutes } from '#lib/format'
import { cn } from '#lib/utils'

function ActionArea({
  status,
  onComplete,
}: {
  status: Task['status']
  onComplete: () => void
}) {
  if (status === 'completed') return null

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onComplete()
        }}
        className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2E2E2E] text-white transition-opacity hover:opacity-80"
        aria-label="Complete task"
      >
        <Check className="h-3 w-3" />
      </button>
    </div>
  )
}

function ContextBadge({ context }: { context: Task['context'] }) {
  if (context === 'personal') return null

  return (
    <span
      className={cn(
        'rounded-[10px] px-2 py-0.5 text-[11px] font-medium',
        context === 'work' && 'bg-[#3D2020] text-[#FF5C33]',
        context === 'dev' && 'bg-[#1A2040] text-[#B2B2FF]',
      )}
    >
      {context}
    </span>
  )
}

interface TaskRowBaseProps {
  id: string
  title: string
  status: Task['status']
  context: Task['context']
  estimatedMinutes: number | null
  parentNumber: number | null
  githubLink: GithubLink | null
}

function TaskRowContent({
  id,
  title,
  status,
  context,
  estimatedMinutes,
  parentNumber,
  githubLink,
}: TaskRowBaseProps) {
  const completeTask = useCompleteTask()
  const updateStatus = useUpdateTaskStatus()
  const isInProgress = status === 'in_progress'
  const isCompleted = status === 'completed'

  const handleStatusChange = (newStatus: Task['status']) => {
    if (newStatus === status) return
    if (newStatus === 'completed') {
      completeTask.mutate(id)
    } else {
      updateStatus.mutate({ id, status: newStatus })
    }
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2',
        isInProgress &&
          'border-l-[3px] border-b border-b-primary border-l-primary bg-[#2D1F0F]',
        !isInProgress && 'border-b border-b-border',
        isCompleted && 'opacity-50',
      )}
    >
      <TaskStatusPicker status={status} onStatusChange={handleStatusChange} />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {/* TopRow */}
        <div className="flex items-center gap-2 overflow-hidden">
          <span
            className={cn(
              'truncate text-sm',
              isInProgress && 'font-semibold',
              isCompleted && 'font-normal text-muted-foreground',
              !isInProgress && !isCompleted && 'font-medium',
            )}
          >
            {title}
          </span>
          {parentNumber != null && (
            <span className="shrink-0 text-xs text-muted-foreground">
              ← #{parentNumber}
            </span>
          )}
        </div>

        {/* BottomRow */}
        <div className="flex items-center gap-1.5">
          <ContextBadge context={context} />
          {githubLink != null && <GithubLinkBadge link={githubLink} />}
          {estimatedMinutes != null && (
            <span className="font-mono text-xs text-muted-foreground">
              {formatMinutes(estimatedMinutes)}
            </span>
          )}
        </div>
      </div>

      <ActionArea
        status={status}
        onComplete={() => {
          completeTask.mutate(id)
        }}
      />
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
        title={task.title}
        status={task.status}
        context={task.context}
        estimatedMinutes={task.estimatedMinutes}
        parentNumber={task.parentNumber}
        githubLink={task.githubLink}
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
  const completeTask = useCompleteTask()
  const updateStatus = useUpdateTaskStatus()
  const hasChildren = node.children.length > 0
  const isInProgress = node.status === 'in_progress'
  const isCompleted = node.status === 'completed'

  const handleExpand = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setExpanded(!expanded)
  }

  const handleStatusChange = (newStatus: Task['status']) => {
    if (newStatus === node.status) return
    if (newStatus === 'completed') {
      completeTask.mutate(node.id)
    } else {
      updateStatus.mutate({ id: node.id, status: newStatus })
    }
  }

  return (
    <>
      <Link
        to="/tasks/$taskId"
        params={{ taskId: node.id }}
        className="block transition-colors hover:bg-secondary/30"
      >
        <div
          className={cn(
            'flex items-center gap-2 px-3 py-2',
            isInProgress &&
              'border-l-[3px] border-b border-b-primary border-l-primary bg-[#2D1F0F]',
            !isInProgress && 'border-b border-b-border',
            isCompleted && 'opacity-50',
          )}
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
              <span
                className={cn(
                  'truncate text-sm',
                  isInProgress && 'font-semibold',
                  isCompleted && 'font-normal text-muted-foreground',
                  !isInProgress && !isCompleted && 'font-medium',
                )}
              >
                {node.title}
              </span>
            </div>

            {/* BottomRow */}
            <div className="flex items-center gap-1.5">
              {/* Child completion count */}
              {node.childCompletionCount.total > 0 && (
                <span
                  className="text-xs text-muted-foreground"
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
              {node.estimatedMinutes != null && (
                <span className="font-mono text-xs text-muted-foreground">
                  {formatMinutes(node.estimatedMinutes)}
                </span>
              )}
            </div>
          </div>

          <ActionArea
            status={node.status}
            onComplete={() => {
              completeTask.mutate(node.id)
            }}
          />
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
