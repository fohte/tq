import { Link } from '@tanstack/react-router'

import { TaskStatusPicker } from '#components/task/task-status-picker'
import { Panel } from '#components/ui/panel'
import { SectionHeading } from '#components/ui/section-heading'
import { SectionLoadingIndicator } from '#components/ui/section-loading-indicator'
import type { Task } from '#hooks/use-tasks'
import { useTaskList, useUpdateTaskStatus } from '#hooks/use-tasks'
import { formatMinutes } from '#lib/format'
import { cn } from '#lib/utils'

// --- Subtasks Section (in task detail, self-fetching) ---

export function TaskSubtasksSection({ taskId }: { taskId: string }) {
  const { categorized, isLoading, isError } = useTaskList({ parentId: taskId })

  if (isLoading) {
    return <SectionLoadingIndicator label="subtasks" />
  }

  if (isError) {
    return (
      <p className="font-mono text-xs text-destructive">
        Failed to load subtasks.
      </p>
    )
  }

  return <TaskSubtasksList subtasks={categorized.all} />
}

// --- Subtasks List (pure presentation, for Storybook) ---

export function TaskSubtasksList({ subtasks }: { subtasks: Task[] }) {
  if (subtasks.length === 0) return null

  const completed = subtasks.filter((t) => t.status === 'completed').length

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline gap-2">
        <SectionHeading level={3}>subtasks</SectionHeading>
        <span className="font-mono text-[11px] text-muted-foreground-faint">
          {completed}/{subtasks.length}
        </span>
      </div>
      <Panel>
        {subtasks.map((subtask) => (
          <SubtaskRow key={subtask.id} subtask={subtask} />
        ))}
      </Panel>
    </div>
  )
}

// --- Subtask Row ---

function SubtaskRow({ subtask }: { subtask: Task }) {
  const updateStatus = useUpdateTaskStatus()
  const isCompleted = subtask.status === 'completed'

  return (
    <div className="flex items-center gap-2.5 border-b border-border px-3 py-2.5 last:border-b-0">
      <TaskStatusPicker
        status={subtask.status}
        onStatusChange={(status) => {
          updateStatus.mutate({ id: subtask.id, status })
        }}
      />
      <Link
        to="/tasks/$taskId"
        params={{ taskId: subtask.id }}
        className={cn(
          'truncate text-sm transition-colors hover:text-muted-foreground-strong',
          isCompleted && 'text-muted-foreground line-through',
        )}
      >
        {subtask.title}
      </Link>
      {subtask.estimatedMinutes != null && (
        <span className="ml-auto shrink-0 font-mono text-[11px] text-muted-foreground-faint">
          {formatMinutes(subtask.estimatedMinutes)}
        </span>
      )}
    </div>
  )
}
