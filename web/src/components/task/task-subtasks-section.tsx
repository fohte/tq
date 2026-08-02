import { Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useState } from 'react'

import type { InheritedTaskAttributes } from '#components/task/create-task-inline'
import { CreateTaskInline } from '#components/task/create-task-inline'
import { TaskStatusPicker } from '#components/task/task-status-picker'
import { Panel } from '#components/ui/panel'
import { SectionHeading } from '#components/ui/section-heading'
import { SectionLoadingIndicator } from '#components/ui/section-loading-indicator'
import type { Task } from '#hooks/use-tasks'
import { useTaskList, useUpdateTaskStatus } from '#hooks/use-tasks'
import { formatMinutes } from '#lib/format'
import { cn } from '#lib/utils'

// --- Subtasks Section (in task detail, self-fetching) ---

export function TaskSubtasksSection({
  taskId,
  parentTaskNumber,
  inherited,
}: {
  taskId: string
  parentTaskNumber: number
  inherited: InheritedTaskAttributes
}) {
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

  return (
    <TaskSubtasksList
      taskId={taskId}
      parentTaskNumber={parentTaskNumber}
      subtasks={categorized.all}
      inherited={inherited}
    />
  )
}

// --- Subtasks List (pure presentation, for Storybook) ---

export function TaskSubtasksList({
  taskId,
  parentTaskNumber,
  subtasks,
  inherited,
}: {
  taskId: string
  parentTaskNumber: number
  subtasks: Task[]
  inherited: InheritedTaskAttributes
}) {
  const completed = subtasks.filter((t) => t.status === 'completed').length

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline gap-2">
        <SectionHeading level={3}>subtasks</SectionHeading>
        {subtasks.length > 0 && (
          <span className="font-mono text-[11px] text-muted-foreground-faint">
            {completed}/{subtasks.length}
          </span>
        )}
      </div>
      <Panel>
        {subtasks.map((subtask) => (
          <SubtaskRow key={subtask.id} subtask={subtask} />
        ))}
        <AddSubtaskRow
          taskId={taskId}
          parentTaskNumber={parentTaskNumber}
          inherited={inherited}
        />
      </Panel>
    </div>
  )
}

// --- Add Subtask Row ---

function AddSubtaskRow({
  taskId,
  parentTaskNumber,
  inherited,
}: {
  taskId: string
  parentTaskNumber: number
  inherited: InheritedTaskAttributes
}) {
  const [isAdding, setIsAdding] = useState(false)

  if (isAdding) {
    return (
      <div className="border-t border-border">
        <CreateTaskInline
          parentId={taskId}
          parentTaskNumber={parentTaskNumber}
          inherited={inherited}
          closeOnSubmit={false}
          onClose={() => {
            setIsAdding(false)
          }}
        />
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        setIsAdding(true)
      }}
      className="flex min-h-[44px] w-full items-center gap-1.5 border-t border-dashed border-border px-3 font-mono text-xs text-muted-foreground-faint transition-colors hover:text-muted-foreground"
    >
      <Plus className="size-3" />
      add subtask
    </button>
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
