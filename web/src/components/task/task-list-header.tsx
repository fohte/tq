import { ProgressBar } from '#components/ui/progress-bar'
import type { Task } from '#hooks/use-tasks'

export function TaskListHeader({ tasks }: { tasks: Task[] }) {
  const total = tasks.length
  const completed = tasks.filter((task) => task.status === 'completed').length
  const progress = total > 0 ? (completed / total) * 100 : 0

  return (
    <div className="flex flex-col gap-2 px-3">
      <div className="flex items-baseline gap-2.5 font-mono text-2xs">
        <span className="text-foreground">
          {completed}
          <span className="text-muted-foreground-faint">/</span>
          {total}
        </span>
        <span className="text-muted-foreground-faint">done</span>
      </div>

      <ProgressBar percent={progress} />
    </div>
  )
}
