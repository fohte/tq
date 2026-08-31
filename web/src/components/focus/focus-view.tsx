import { Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'

import { TaskRowAppearance } from '#components/task/task-row-appearance'
import { Button } from '#components/ui/button'
import { DotSeparatedList } from '#components/ui/dot-separated-list'
import { Panel } from '#components/ui/panel'
import { ProgressBar } from '#components/ui/progress-bar'
import { ScreenHeaderBar } from '#components/ui/screen-header-bar'
import { SectionHeading } from '#components/ui/section-heading'
import { Textarea } from '#components/ui/textarea'
import { useFocusNotes } from '#hooks/use-focus-notes'
import type { Task } from '#hooks/use-tasks'
import { useCompleteTask } from '#hooks/use-tasks'
import { formatMinutes } from '#lib/format'

export interface FocusViewPresentationProps {
  isLoading: boolean
  queueTasks: Task[]
  focusTask: Task | null
  nextTask: Task | null
  subtasks: Task[]
  onDefer: (taskId: string) => void
}

function FocusLabel({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-2xs tracking-widest text-muted-foreground-faint">
      {children}
    </span>
  )
}

function focusCardStatusLabel(status: Task['status']): string {
  return status === 'completed' ? 'COMPLETED' : 'TODO'
}

function FocusHeader() {
  return (
    <ScreenHeaderBar>
      <SectionHeading level={2}>today</SectionHeading>
      <span className="ml-auto font-mono text-2xs whitespace-nowrap text-muted-foreground">
        focus mode
      </span>
    </ScreenHeaderBar>
  )
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
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-3 font-mono text-2xs whitespace-nowrap">
        <span className="text-muted-foreground-strong">
          {completed}
          <span className="text-muted-foreground-faint">/</span>
          {total} completed
        </span>
        {totalEstimate > 0 && (
          <span
            className="ml-auto text-muted-foreground-strong"
            data-testid="focus-remaining-time"
          >
            <span className="md:hidden">
              {formatMinutes(remainingEstimate)} left
            </span>
            <span className="hidden md:inline">
              remaining {formatMinutes(remainingEstimate)}
              <span className="text-muted-foreground-faint">
                {' '}
                / {formatMinutes(totalEstimate)}
              </span>
            </span>
          </span>
        )}
      </div>
      <ProgressBar percent={progress} />
    </div>
  )
}

function FocusCard({
  task,
  onDefer,
}: {
  task: Task
  onDefer: (taskId: string) => void
}) {
  const completeTask = useCompleteTask()

  return (
    <div className="border border-border bg-card p-5 md:p-6">
      <div className="flex items-center gap-2">
        <span className="font-mono text-2xs text-primary">▍</span>
        <FocusLabel>{focusCardStatusLabel(task.status)}</FocusLabel>
        <span className="ml-auto inline-flex items-center gap-x-1 font-mono text-2xs tracking-widest text-muted-foreground">
          <DotSeparatedList items={[`#${String(task.number)}`, task.context]} />
        </span>
      </div>
      <h1 className="mt-3 text-xl leading-snug font-bold text-pretty md:mt-3.5 md:text-2xl">
        {task.title}
      </h1>
      <div className="mt-4 flex items-center gap-3 md:mt-5">
        <Button
          className="flex-1 md:flex-none"
          onClick={() => {
            completeTask.mutate(task.id)
          }}
        >
          complete
        </Button>
        <Button
          variant="secondary"
          className="hidden md:inline-flex"
          onClick={() => {
            onDefer(task.id)
          }}
        >
          defer
        </Button>
        {task.estimatedMinutes != null && (
          <span className="font-mono text-sm text-muted-foreground-strong md:ml-auto">
            {formatMinutes(task.estimatedMinutes)}
          </span>
        )}
      </div>
    </div>
  )
}

function FocusSubtasks({ subtasks }: { subtasks: Task[] }) {
  const completed = subtasks.filter((t) => t.status === 'completed').length

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <FocusLabel>SUBTASKS</FocusLabel>
        <span className="font-mono text-2xs tracking-widest text-muted-foreground">
          {completed}/{subtasks.length}
        </span>
      </div>
      <Panel>
        {subtasks.map((subtask) => (
          <TaskRowAppearance key={subtask.id} task={subtask} />
        ))}
      </Panel>
    </div>
  )
}

function FocusNotes({ taskId }: { taskId: string }) {
  const [notes, setNotes] = useFocusNotes(taskId)

  return (
    <div className="flex flex-col gap-2">
      <FocusLabel>NOTES</FocusLabel>
      <Textarea
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value)
        }}
        placeholder="Jot down notes while you work..."
        rows={5}
        className="resize-y bg-card p-3 font-editor text-xs leading-relaxed"
      />
    </div>
  )
}

function FocusUpNext({ task }: { task: Task }) {
  return (
    <Panel className="flex items-center gap-3 p-3.5">
      <FocusLabel>UP NEXT</FocusLabel>
      <span className="hidden font-mono text-2xs text-muted-foreground-faint md:inline">
        #{task.number}
      </span>
      <span className="truncate text-sm text-muted-foreground-strong">
        {task.title}
      </span>
      {task.estimatedMinutes != null && (
        <span className="ml-auto shrink-0 font-mono text-2xs text-muted-foreground">
          {formatMinutes(task.estimatedMinutes)}
        </span>
      )}
    </Panel>
  )
}

export function FocusViewPresentation({
  isLoading,
  queueTasks,
  focusTask,
  nextTask,
  subtasks,
  onDefer,
}: FocusViewPresentationProps) {
  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        <FocusHeader />
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!focusTask) {
    return (
      <div className="flex h-full flex-col">
        <FocusHeader />
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
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
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <FocusHeader />
      <div className="flex flex-1 justify-center overflow-y-auto px-3.5 py-4 md:px-6 md:py-10">
        <div className="flex w-full max-w-3xl flex-col gap-5 md:gap-7">
          <FocusProgress tasks={queueTasks} />
          <FocusCard task={focusTask} onDefer={onDefer} />
          {subtasks.length > 0 && <FocusSubtasks subtasks={subtasks} />}
          <FocusNotes taskId={focusTask.id} />
          {nextTask && <FocusUpNext task={nextTask} />}
        </div>
      </div>
    </div>
  )
}
