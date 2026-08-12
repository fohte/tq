import { ProgressBar } from '#components/ui/progress-bar'
import type { Task } from '#hooks/use-tasks'
import { formatMinutes } from '#lib/format'

export function TaskListHeader({ tasks }: { tasks: Task[] }) {
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
  const progress = total > 0 ? (completed / total) * 100 : 0

  return (
    <div className="flex flex-col gap-[7px] px-3">
      <div className="flex items-baseline gap-2.5 font-mono text-2xs">
        <span className="text-foreground">
          {completed}
          <span className="text-muted-foreground-faint">/</span>
          {total}
        </span>
        <span className="text-muted-foreground-faint">done</span>
        {totalEstimate > 0 && (
          <span className="ml-auto whitespace-nowrap text-muted-foreground-strong">
            {formatMinutes(completedEstimate)}
            <span className="text-muted-foreground-faint"> / </span>
            {formatMinutes(totalEstimate)}
          </span>
        )}
      </div>

      <ProgressBar percent={progress} />
    </div>
  )
}
