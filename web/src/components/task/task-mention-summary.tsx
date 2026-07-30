import { StatusIcon } from '#components/task/task-row'
import type { Task } from '#hooks/use-tasks'
import { cn } from '#lib/utils'

export function TaskMentionSummary({
  status,
  number,
  title,
  titleClassName,
}: {
  status: Task['status']
  number: number
  title: string
  titleClassName?: string
}) {
  return (
    <>
      <StatusIcon status={status} />
      <span className="shrink-0 text-muted-foreground">#{number}</span>
      <span className={cn('truncate', titleClassName)}>{title}</span>
    </>
  )
}
