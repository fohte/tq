import type { Task } from '@web/hooks/use-tasks'
import { formatMinutes } from '@web/lib/format'
import { cn } from '@web/lib/utils'

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
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>
          {completed}/{total} tasks
        </span>
        {totalEstimate > 0 && (
          <>
            <span className="text-border">|</span>
            <span className="font-mono">
              {formatMinutes(completedEstimate)}/{formatMinutes(totalEstimate)}
            </span>
          </>
        )}
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn(
            'h-full rounded-full bg-primary transition-all duration-300',
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
