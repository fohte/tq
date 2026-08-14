import { Chip } from '#components/ui/chip'
import { useTagFilter } from '#hooks/use-tag-filter'
import type { Task } from '#hooks/use-tasks'
import { useCompleteTask, useUpdateTaskStatus } from '#hooks/use-tasks'
import { formatMinutes } from '#lib/format'
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

// Row indent is a per-instance value (depth is unbounded), so it can't be a
// static Tailwind class. Set as a custom property via `style` and consumed
// through `ROW_INDENT_CLASS_NAME`'s `pl-(--row-indent)` utility.
export const ROW_INDENT_CLASS_NAME = 'pl-(--row-indent)'

interface RowIndentStyle extends React.CSSProperties {
  '--row-indent': string
}

// 3 spacing units (12px) base, +4 units (16px) per depth level — both
// multiples of Tailwind's --spacing unit, so every depth lands on-grid
// instead of accumulating an off-grid offset.
export function rowIndentStyle(depth: number): RowIndentStyle {
  return {
    '--row-indent': `calc(var(--spacing) * ${String(3 + depth * 4)})`,
  }
}

export function gridRowWrapperClassName(
  isInProgress: boolean,
  isCompleted: boolean,
) {
  return cn(
    'border-b border-border border-l-2 border-l-transparent px-3 py-2 transition-colors hover:bg-secondary/30',
    isInProgress && 'border-l-primary bg-card',
    isCompleted && 'dim-completed',
  )
}

export function gridRowTitleClassName(
  isInProgress: boolean,
  isCompleted: boolean,
) {
  return cn(
    'truncate text-sm',
    isInProgress ? 'font-semibold' : 'font-normal',
    isCompleted && 'text-muted-foreground line-through',
  )
}

export function GridEstimate({
  estimatedMinutes,
  isCompleted,
}: {
  estimatedMinutes: number
  isCompleted: boolean
}) {
  return (
    <span
      className={cn(
        'shrink-0 text-right font-mono text-xs',
        isCompleted ? 'text-muted-foreground-faint' : 'text-muted-foreground',
      )}
    >
      {formatMinutes(estimatedMinutes)}
    </span>
  )
}
