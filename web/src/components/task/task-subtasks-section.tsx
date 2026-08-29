import { Plus } from 'lucide-react'
import { useState } from 'react'

import type { InheritedTaskAttributes } from '#components/task/create-task-inline'
import { CreateTaskInline } from '#components/task/create-task-inline'
import { TaskRowAppearance } from '#components/task/task-row-appearance'
import { Panel } from '#components/ui/panel'
import { SectionHeading } from '#components/ui/section-heading'
import { SectionLoadingIndicator } from '#components/ui/section-loading-indicator'
import type { Task } from '#hooks/use-tasks'
import { useTaskList } from '#hooks/use-tasks'

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
          <span className="font-mono text-2xs text-muted-foreground-faint">
            {completed}/{subtasks.length}
          </span>
        )}
      </div>
      <Panel>
        {subtasks.map((subtask) => (
          <TaskRowAppearance key={subtask.id} task={subtask} />
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
      className="flex min-h-11 w-full items-center gap-1.5 border-t border-dashed border-border px-3 font-mono text-xs text-muted-foreground-faint transition-colors hover:text-muted-foreground"
    >
      <Plus className="size-3" />
      add subtask
    </button>
  )
}
