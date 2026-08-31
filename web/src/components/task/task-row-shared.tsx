import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import { TaskSearchCandidateDialog } from '#components/task/task-search-candidate-dialog'
import type { StatusPickerValue } from '#components/task/task-status-picker'
import { useProject } from '#hooks/use-projects'
import type { SearchResult } from '#hooks/use-search'
import type { Task } from '#hooks/use-tasks'
import { useCompleteTask, useUpdateTaskStatus } from '#hooks/use-tasks'
import { formatMinutes } from '#lib/format'
import { formatShortDate, isTaskOverdue } from '#lib/task-due-date'
import { tagFilterSearch } from '#lib/tasks-query'
import { cn } from '#lib/utils'

export function useHandleStatusChange(
  id: string,
  status: Task['status'],
  statusReason: Task['statusReason'],
) {
  const completeTask = useCompleteTask()
  const updateStatus = useUpdateTaskStatus()
  const [duplicatePickerOpen, setDuplicatePickerOpen] = useState(false)
  const currentValue: StatusPickerValue =
    status === 'completed' ? (statusReason ?? 'completed') : 'todo'

  const closeWithReason = (
    reason: 'completed' | 'not_planned' | 'duplicate',
    duplicateOfTaskId?: string,
  ) => {
    // exactOptionalPropertyTypes: mutate()'s duplicateOfTaskId?: string
    // rejects an explicit `undefined` value, so the key must be omitted
    // rather than set to undefined when there's no candidate.
    const duplicateOfTaskIdField =
      duplicateOfTaskId != null ? { duplicateOfTaskId } : {}
    if (status === 'completed') {
      // Already closed — this is relabeling the close reason, not closing
      // the task, so it must go through /status rather than /complete:
      // /complete 409s on an already-completed task, and its recurrence
      // side effect only belongs to the actual close transition.
      updateStatus.mutate({
        id,
        status: 'completed',
        statusReason: reason,
        ...duplicateOfTaskIdField,
      })
    } else {
      completeTask.mutate({
        id,
        statusReason: reason,
        ...duplicateOfTaskIdField,
      })
    }
  }

  const closeAsDuplicate = (duplicateOfTaskId?: string) => {
    closeWithReason('duplicate', duplicateOfTaskId)
  }

  const handleValueChange = (value: StatusPickerValue) => {
    if (value === currentValue) return
    if (value === 'todo') {
      updateStatus.mutate({ id, status: value })
      return
    }
    if (value === 'duplicate') {
      setDuplicatePickerOpen(true)
      return
    }
    closeWithReason(value)
  }

  const duplicatePicker = (
    <TaskSearchCandidateDialog
      open={duplicatePickerOpen}
      onOpenChange={setDuplicatePickerOpen}
      title="Duplicate of"
      excludedTaskIds={new Set([id])}
      onSelectCandidate={(candidate: SearchResult) => {
        closeAsDuplicate(candidate.id)
        setDuplicatePickerOpen(false)
      }}
      skipAction={{
        label: 'Close without linking',
        onSkip: () => {
          closeAsDuplicate(undefined)
          setDuplicatePickerOpen(false)
        },
      }}
    />
  )

  return { handleValueChange, duplicatePicker }
}

export function TagTokens({
  labels,
  isCompleted,
}: {
  labels: string[]
  isCompleted: boolean
}) {
  const navigate = useNavigate()

  return (
    <div className="flex items-center gap-1.5">
      {labels.map((label) => (
        <button
          key={label}
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            void navigate({ to: '/tasks', search: tagFilterSearch(label) })
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
      {formatShortDate(dueDate)}
    </span>
  )
}

export function StartDateBadge({ startDate }: { startDate: string }) {
  return (
    <span className="shrink-0 font-mono text-xs text-muted-foreground">
      {formatShortDate(startDate)}
    </span>
  )
}

export function TaskProjectLabel({ projectId }: { projectId: string }) {
  const { data: project } = useProject(projectId)
  if (project == null) return null

  return (
    <span className="max-w-32 shrink-0 truncate font-mono text-xs text-muted-foreground">
      {project.title}
    </span>
  )
}

export function TaskContextLabel({ context }: { context: Task['context'] }) {
  return (
    <span className="shrink-0 font-mono text-xs text-muted-foreground">
      {context}
    </span>
  )
}

export function ParentTaskLabel({ parentNumber }: { parentNumber: number }) {
  return (
    <span className="shrink-0 font-mono text-xs text-muted-foreground">
      ← #{parentNumber}
    </span>
  )
}

export function EstimateLabel({ minutes }: { minutes: number }) {
  return (
    <span className="shrink-0 whitespace-nowrap font-mono text-xs text-muted-foreground">
      {formatMinutes(minutes)}
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

export function CloseReasonLabel({
  reason,
  duplicateOfNumber,
}: {
  reason: 'not_planned' | 'duplicate'
  duplicateOfNumber: number | null
}) {
  const text =
    reason === 'not_planned'
      ? 'not planned'
      : duplicateOfNumber != null
        ? `duplicate of #${String(duplicateOfNumber)}`
        : 'duplicate'

  return (
    <span className="shrink-0 font-mono text-xs text-muted-foreground">
      {text}
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

export function rowWrapperClassName(isCompleted: boolean) {
  return cn(
    'border-b border-border border-l-2 border-l-transparent px-3 py-2 transition-colors hover:bg-secondary/30',
    isCompleted && 'dim-completed',
  )
}

export function rowTitleClassName(isCompleted: boolean) {
  return cn(
    'truncate text-sm font-normal',
    isCompleted && 'text-muted-foreground line-through',
  )
}
