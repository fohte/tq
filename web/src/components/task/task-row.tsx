import { Link } from '@tanstack/react-router'
import type { Task } from '@web/hooks/use-tasks'
import { useUpdateTaskStatus } from '@web/hooks/use-tasks'
import { formatMinutes } from '@web/lib/format'
import { cn } from '@web/lib/utils'
import { Check, Circle, Play } from 'lucide-react'

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
