import { Chip } from '#components/ui/chip'
import { useTagFilter } from '#hooks/use-tag-filter'
import type { Task } from '#hooks/use-tasks'
import { useCompleteTask, useUpdateTaskStatus } from '#hooks/use-tasks'
import { formatDueDate, isTaskOverdue } from '#lib/task-due-date'
import { cn } from '#lib/utils'

export function useHandleStatusChange(id: string, status: Task['status']) {
  const completeTask = useCompleteTask()
  const updateStatus = useUpdateTaskStatus()

  return (newStatus: Task['status']) => {
    if (newStatus === status) return
    if (newStatus === 'completed') {
      completeTask.mutate(id)
    } else {
      updateStatus.mutate({ id, status: newStatus })
    }
  }
}

export function ContextBadge({ context }: { context: Task['context'] }) {
  return <Chip>{context}</Chip>
}

export function TagTokens({
  labels,
  isCompleted,
}: {
  labels: string[]
  isCompleted: boolean
}) {
  const { setTag } = useTagFilter()

  return (
    <div className="flex items-center gap-1.5">
      {labels.map((label) => (
        <button
          key={label}
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setTag(label)
          }}
          className={cn(
            'font-mono text-xs hover:text-foreground',
            isCompleted
              ? 'text-muted-foreground-faint'
              : 'text-muted-foreground',
          )}
        >
          #{label}
        </button>
      ))}
    </div>
  )
}

export function DueDateBadge({
  dueDate,
  status,
}: {
  dueDate: string
  status: Task['status']
}) {
  const overdue = isTaskOverdue({ status, dueDate })

  return (
    <span
      className={cn(
        'shrink-0 font-mono text-xs',
        overdue ? 'text-primary' : 'text-muted-foreground',
      )}
    >
      {formatDueDate(dueDate)}
    </span>
  )
}

export function TaskNumberLabel({ number }: { number: number }) {
  return (
    <span className="shrink-0 font-mono text-xs text-muted-foreground-faint">
      #{number}
    </span>
  )
}
