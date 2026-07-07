import { useFocusNotes } from '@web/hooks/use-focus-notes'
import { useLiveTimer } from '@web/hooks/use-live-timer'
import type { Task } from '@web/hooks/use-tasks'
import { useTaskActions, useUpdateTaskStatus } from '@web/hooks/use-tasks'
import { formatMinutes } from '@web/lib/format'
import { cn } from '@web/lib/utils'
import { Check, Loader2, Play, Square } from 'lucide-react'

export interface FocusViewPresentationProps {
  isLoading: boolean
  queueTasks: Task[]
  focusTask: Task | null
  nextTask: Task | null
  subtasks: Task[]
}

function FocusProgress({ tasks }: { tasks: Task[] }) {
  const total = tasks.length
  const { completed, totalEstimate, completedEstimate } = tasks.reduce(
    (acc, t) => {
      if (t.status === 'completed') {
        acc.completed++
        acc.completedEstimate += t.estimatedMinutes ?? 0
      }
      acc.totalEstimate += t.estimatedMinutes ?? 0
      return acc
    },
    { completed: 0, totalEstimate: 0, completedEstimate: 0 },
  )
  const remainingEstimate = totalEstimate - completedEstimate
  const progress = total > 0 ? (completed / total) * 100 : 0

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {completed}/{total} completed
        </span>
        {totalEstimate > 0 && (
          <span className="font-mono" data-testid="focus-remaining-time">
            Remaining: {formatMinutes(remainingEstimate)} /{' '}
            {formatMinutes(totalEstimate)}
          </span>
        )}
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${String(progress)}%` }}
        />
      </div>
    </div>
  )
}

function FocusTimer({ task }: { task: Task }) {
  const { formatted, isOverEstimate } = useLiveTimer(
    task.activeTimeBlockStartTime,
    task.estimatedMinutes,
  )

  return (
    <div className="flex flex-col items-center gap-1">
      <span
        data-testid="focus-timer"
        className={cn(
          'font-mono text-[48px] font-bold leading-none tabular-nums',
          isOverEstimate ? 'text-destructive' : 'text-primary',
        )}
      >
        {formatted}
      </span>
      {task.estimatedMinutes != null && (
        <span className="text-xs text-muted-foreground">
          est: {formatMinutes(task.estimatedMinutes)}
        </span>
      )}
    </div>
  )
}

function FocusActions({ task }: { task: Task }) {
  const { handleStatusAction, handleComplete } = useTaskActions(
    task.id,
    task.status,
  )

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleStatusAction}
        className={cn(
          'flex h-12 w-12 items-center justify-center rounded-full text-white transition-opacity hover:opacity-80',
          task.status === 'in_progress' ? 'bg-destructive' : 'bg-primary',
        )}
        aria-label={task.status === 'in_progress' ? 'Stop task' : 'Start task'}
      >
        {task.status === 'in_progress' ? (
          <Square className="h-5 w-5 fill-current" />
        ) : (
          <Play className="h-5 w-5 fill-current" />
        )}
      </button>

      <button
        type="button"
        onClick={handleComplete}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-[#2E2E2E] text-white transition-opacity hover:opacity-80"
        aria-label="Complete task"
      >
        <Check className="h-5 w-5" />
      </button>
    </div>
  )
}

function FocusSubtaskChecklist({ subtasks }: { subtasks: Task[] }) {
  const updateStatus = useUpdateTaskStatus()
  const completed = subtasks.filter((t) => t.status === 'completed').length

  return (
    <div className="w-full space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Subtasks ({completed}/{subtasks.length})
      </h3>
      <ul className="space-y-1.5">
        {subtasks.map((subtask) => {
          const isCompleted = subtask.status === 'completed'
          return (
            <li key={subtask.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  updateStatus.mutate({
                    id: subtask.id,
                    status: isCompleted ? 'todo' : 'completed',
                  })
                }}
                aria-label={
                  isCompleted
                    ? `Mark "${subtask.title}" as todo`
                    : `Mark "${subtask.title}" as completed`
                }
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
                  isCompleted
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-muted-foreground/40 text-muted-foreground/40 hover:border-muted-foreground',
                )}
              >
                {isCompleted && <Check className="h-3 w-3" />}
              </button>
              <span
                className={cn(
                  'text-sm',
                  isCompleted && 'text-muted-foreground line-through',
                )}
              >
                {subtask.title}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function FocusNotes({ taskId }: { taskId: string }) {
  const [notes, setNotes] = useFocusNotes(taskId)

  return (
    <div className="w-full">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Notes
      </h3>
      <textarea
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value)
        }}
        placeholder="Jot down notes while you work..."
        rows={4}
        className="w-full resize-none rounded-lg border border-border bg-transparent p-3 text-sm outline-none focus:border-primary/50"
      />
    </div>
  )
}

function FocusNextTaskPreview({ task }: { task: Task }) {
  return (
    <div className="flex w-full items-center justify-between rounded-lg border border-border bg-secondary/30 px-4 py-3">
      <div className="flex min-w-0 flex-col">
        <span className="text-xs text-muted-foreground">Up next</span>
        <span className="truncate text-sm font-medium">{task.title}</span>
      </div>
      {task.estimatedMinutes != null && (
        <span className="shrink-0 font-mono text-xs text-muted-foreground">
          {formatMinutes(task.estimatedMinutes)}
        </span>
      )}
    </div>
  )
}

export function FocusViewPresentation({
  isLoading,
  queueTasks,
  focusTask,
  nextTask,
  subtasks,
}: FocusViewPresentationProps) {
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!focusTask) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-lg font-medium">
          {queueTasks.length === 0
            ? "No tasks in today's queue"
            : 'All tasks completed for today'}
        </p>
        <p className="text-sm text-muted-foreground">
          {queueTasks.length === 0
            ? 'Add tasks to your queue from the Day View.'
            : 'Great work today.'}
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col items-center gap-8 overflow-auto p-6 md:justify-center">
      <div className="w-full max-w-lg">
        <FocusProgress tasks={queueTasks} />
      </div>

      <div className="flex w-full max-w-lg flex-col items-center gap-4 text-center">
        <h1 className="text-xl font-semibold">{focusTask.title}</h1>
        <FocusTimer task={focusTask} />
        <FocusActions task={focusTask} />
      </div>

      {subtasks.length > 0 && (
        <div className="w-full max-w-lg">
          <FocusSubtaskChecklist subtasks={subtasks} />
        </div>
      )}

      <div className="w-full max-w-lg">
        <FocusNotes taskId={focusTask.id} />
      </div>

      {nextTask && (
        <div className="w-full max-w-lg">
          <FocusNextTaskPreview task={nextTask} />
        </div>
      )}
    </div>
  )
}
