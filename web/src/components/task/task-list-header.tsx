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
    <div className="space-y-2 px-3">
      <div className="flex items-center gap-3 font-mono text-xs text-muted-foreground">
        <span>
          {completed}/{total} tasks
        </span>
        {totalEstimate > 0 && (
          <>
            <span className="text-border">|</span>
            <span>
              {formatMinutes(completedEstimate)}/{formatMinutes(totalEstimate)}
            </span>
          </>
        )}
      </div>

      <ProgressBar percent={progress} />
    </div>
  )
}
