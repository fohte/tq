import { Link } from '@tanstack/react-router'
import type { Task, TreeNode } from '@web/hooks/use-tasks'
import { useUpdateTaskStatus } from '@web/hooks/use-tasks'
import { formatMinutes } from '@web/lib/format'
import { cn } from '@web/lib/utils'
import { Check, ChevronDown, ChevronRight, Circle, Play } from 'lucide-react'
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
        status === 'in_progress' && 'border-primary text-primary',
        status === 'todo' &&
          'border-muted-foreground/40 text-muted-foreground/40 hover:border-muted-foreground hover:text-muted-foreground',
      )}
    >
      {status === 'completed' && <Check className="h-3 w-3" />}
      {status === 'in_progress' && <Play className="h-3 w-3 fill-current" />}
      {status === 'todo' && <Circle className="h-3 w-3" />}
    </button>
  )
}

export function TaskRow({ task }: { task: Task }) {
  const updateStatus = useUpdateTaskStatus()

  const handleToggle = () => {
    const nextStatus = task.status === 'completed' ? 'todo' : 'completed'
    updateStatus.mutate({ id: task.id, status: nextStatus })
  }

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
      <StatusIcon status={task.status} onToggle={handleToggle} />

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

        {task.estimatedMinutes != null && (
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
  const updateStatus = useUpdateTaskStatus()
  const hasChildren = node.children.length > 0

  const handleToggle = () => {
    const nextStatus = node.status === 'completed' ? 'todo' : 'completed'
    updateStatus.mutate({ id: node.id, status: nextStatus })
  }

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

        <StatusIcon status={node.status} onToggle={handleToggle} />

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

          {node.estimatedMinutes != null && (
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
