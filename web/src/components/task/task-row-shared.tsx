import { Chip } from '#components/ui/chip'
import { useTagFilter } from '#hooks/use-tag-filter'
import type { Task } from '#hooks/use-tasks'
import { useCompleteTask, useUpdateTaskStatus } from '#hooks/use-tasks'
import { formatMinutes } from '#lib/format'
import { formatDueDate, isTaskOverdue } from '#lib/task-due-date'
import { cn } from '#lib/utils'

// Shared between TaskGridRow, TreeTaskGridRow, and the Tasks list column
// header so the header stays aligned with the row grids. The trailing 28px
// column seats TreeTaskGridRow's row-actions trigger; other consumers still
// render an empty cell there to keep columns aligned.
//
// The title column has a `minmax` floor, not a bare `1fr`: a bare `1fr`
// track has no content-based minimum, so once the row's available width
// drops below what the other columns need, the title track gets squeezed
// to 0 and the title disappears entirely instead of truncating. The floor
// forces the row to overflow (scrollable, since the page body scrolls both
// axes) rather than hide the title.
export const TASK_GRID_COLUMNS =
  'grid-cols-[26px_26px_minmax(120px,1fr)_132px_104px_72px_56px_28px]'

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

export function gridRowWrapperClassName(
  isInProgress: boolean,
  isCompleted: boolean,
) {
  return cn(
    'border-b border-border border-l-2 border-l-transparent px-3 py-2 transition-colors hover:bg-secondary/30',
    isInProgress && 'border-l-primary bg-card',
    isCompleted && 'opacity-[0.55]',
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
