import type { Task } from '@web/hooks/use-tasks'
import { cn } from '@web/lib/utils'

function formatTotalTime(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }
  return `${minutes}m`
}

export function TaskListHeader({ tasks }: { tasks: Task[] }) {
  const total = tasks.length
  const completed = tasks.filter((t) => t.status === 'completed').length
  const totalEstimate = tasks.reduce(
    (sum, t) => sum + (t.estimatedMinutes ?? 0),
    0,
  )
  const completedEstimate = tasks
    .filter((t) => t.status === 'completed')
    .reduce((sum, t) => sum + (t.estimatedMinutes ?? 0), 0)
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
              {formatTotalTime(completedEstimate)}/
              {formatTotalTime(totalEstimate)}
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
