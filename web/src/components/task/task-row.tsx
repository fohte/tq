import { Link } from '@tanstack/react-router'
import { useLiveTimer } from '@web/hooks/use-live-timer'
import type { Task, TreeNode } from '@web/hooks/use-tasks'
import { useTaskActions } from '@web/hooks/use-tasks'
import { formatMinutes } from '@web/lib/format'
import { cn } from '@web/lib/utils'
import { Check, ChevronDown, ChevronRight, Play, Square } from 'lucide-react'
import { useState } from 'react'

function StatusIcon({
  status,
  onToggle,
}: {
  status: Task['status']
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onToggle()
      }}
      className={cn(
        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
        status === 'completed' &&
          'border-primary bg-primary text-primary-foreground',
        status === 'in_progress' &&
          'border-primary text-primary hover:border-destructive hover:text-destructive',
        status === 'todo' &&
          'border-muted-foreground/40 text-muted-foreground/40 hover:border-primary hover:text-primary',
      )}
      aria-label={
        status === 'todo'
          ? 'Start task'
          : status === 'in_progress'
            ? 'Stop task'
            : 'Reopen task'
      }
    >
      {status === 'completed' && <Check className="h-3 w-3" />}
      {status === 'in_progress' && (
        <Square className="h-2.5 w-2.5 fill-current" />
      )}
      {status === 'todo' && <Play className="h-3 w-3 fill-current" />}
    </button>
  )
}

function CompleteButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onClick()
      }}
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-muted-foreground/40 text-muted-foreground/40 transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
      aria-label="Complete task"
    >
      <Check className="h-3 w-3" />
    </button>
  )
}

export function LiveTimer({
  startTime,
  estimatedMinutes,
}: {
  startTime: string | null | undefined
  estimatedMinutes: number | null | undefined
}) {
  const { formatted, isOverEstimate } = useLiveTimer(
    startTime,
    estimatedMinutes,
  )

  return (
    <span
      className={cn(
        'font-mono text-xs tabular-nums',
        isOverEstimate ? 'text-destructive' : 'text-primary',
      )}
      data-testid="live-timer"
    >
      {formatted}
    </span>
  )
}

export function TaskRow({ task }: { task: Task }) {
  const { handleStatusAction, handleComplete } = useTaskActions(
    task.id,
    task.status,
  )

  return (
    <Link
      to="/tasks/$taskId"
      params={{ taskId: task.id }}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 transition-colors',
        'hover:bg-secondary/50',
        task.status === 'completed' && 'opacity-50',
      )}
    >
      <StatusIcon status={task.status} onToggle={handleStatusAction} />

      <div className="min-w-0 flex-1">
        <span
          className={cn(
            'text-sm',
            task.status === 'completed' && 'line-through',
          )}
        >
          {task.title}
        </span>

        {task.parentId && (
          <span className="ml-2 text-xs text-muted-foreground">
            ← #{task.parentId.slice(0, 4)}
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {task.status === 'in_progress' && (
          <>
            <LiveTimer
              startTime={task.activeTimeBlockStartTime ?? task.updatedAt}
              estimatedMinutes={task.estimatedMinutes}
            />
            <CompleteButton onClick={handleComplete} />
          </>
        )}

        {task.context !== 'personal' && (
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-xs',
              task.context === 'work' && 'bg-[#3D2020] text-[#FF5C33]',
              task.context === 'dev' && 'bg-[#1A2040] text-[#B2B2FF]',
            )}
          >
            {task.context}
          </span>
        )}

        {task.estimatedMinutes != null && task.status !== 'in_progress' && (
          <span className="font-mono text-xs text-muted-foreground">
            {formatMinutes(task.estimatedMinutes)}
          </span>
        )}
      </div>
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
  const { handleStatusAction, handleComplete } = useTaskActions(
    node.id,
    node.status,
  )
  const hasChildren = node.children.length > 0

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
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 transition-colors',
          'hover:bg-secondary/50',
          node.status === 'completed' && 'opacity-50',
        )}
        style={{ paddingLeft: `${depth * 24 + 12}px` }}
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

        <StatusIcon status={node.status} onToggle={handleStatusAction} />

        <div className="min-w-0 flex-1">
          <span
            className={cn(
              'text-sm',
              node.status === 'completed' && 'line-through',
            )}
          >
            {node.title}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {node.status === 'in_progress' && (
            <>
              <LiveTimer
                startTime={node.activeTimeBlockStartTime ?? node.updatedAt}
                estimatedMinutes={node.estimatedMinutes}
              />
              <CompleteButton onClick={handleComplete} />
            </>
          )}

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

          {node.context !== 'personal' && (
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs',
                node.context === 'work' && 'bg-[#3D2020] text-[#FF5C33]',
                node.context === 'dev' && 'bg-[#1A2040] text-[#B2B2FF]',
              )}
            >
              {node.context}
            </span>
          )}

          {node.estimatedMinutes != null && node.status !== 'in_progress' && (
            <span className="font-mono text-xs text-muted-foreground">
              {formatMinutes(node.estimatedMinutes)}
            </span>
          )}
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
