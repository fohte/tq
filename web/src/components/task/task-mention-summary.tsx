import { TaskStatusGlyph } from '#components/task/status-icon'
import type { Task } from '#hooks/use-tasks'
import { cn } from '#lib/utils'

export function TaskMentionSummary({
  status,
  statusReason,
  number,
  title,
  titleClassName,
}: {
  status: Task['status']
  statusReason?: Task['statusReason']
  number: number
  title: string
  titleClassName?: string
}) {
  return (
    <>
      <TaskStatusGlyph status={status} statusReason={statusReason ?? null} />
      <span className="shrink-0 font-mono text-muted-foreground">
        #{number}
      </span>
      <span className={cn('truncate', titleClassName)}>{title}</span>
    </>
  )
}
