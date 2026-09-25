import { StatusIcon } from '#components/task/status-icon'
import type { Task } from '#hooks/use-tasks'
import { cn } from '#lib/utils'

export function TaskMentionSummary({
  status,
  number,
  title,
  titleClassName,
  ignoreAncestorSvgSizing = false,
}: {
  status: Task['status']
  number: number
  title: string
  titleClassName?: string
  ignoreAncestorSvgSizing?: boolean
}) {
  return (
    <>
      <StatusIcon
        status={status}
        statusReason={null}
        ignoreAncestorSvgSizing={ignoreAncestorSvgSizing}
      />
      <span className="shrink-0 font-mono text-muted-foreground">
        #{number}
      </span>
      <span className={cn('truncate', titleClassName)}>{title}</span>
    </>
  )
}
