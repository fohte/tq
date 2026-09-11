import { Link } from '@tanstack/react-router'

import { DateRangeBadge } from '#components/task/task-row-shared'
import { ListAreaMessage } from '#components/ui/list-area-message'
import { SectionHeading } from '#components/ui/section-heading'
import { useTaskList } from '#hooks/use-tasks'

export function GeneratedTasksList({ templateId }: { templateId: string }) {
  const { data: tasks, isLoading } = useTaskList({ templateId })

  // Most recent occurrence first.
  const sorted = [...(tasks ?? [])].sort((a, b) =>
    (b.dueDate ?? '').localeCompare(a.dueDate ?? ''),
  )

  return (
    <div className="flex flex-col gap-2.5">
      <SectionHeading level={3}>Generated tasks</SectionHeading>
      {isLoading ? (
        <ListAreaMessage>Loading...</ListAreaMessage>
      ) : sorted.length === 0 ? (
        <ListAreaMessage>No tasks generated yet.</ListAreaMessage>
      ) : (
        <div className="border border-border">
          {sorted.map((task) => (
            <Link
              key={task.id}
              to="/tasks/$taskId"
              params={{ taskId: task.id }}
              className="flex items-center gap-2 border-b border-border px-3 py-2 font-mono text-xs hover:bg-card"
            >
              <span className="shrink-0 text-muted-foreground-faint">
                #{task.number}
              </span>
              <span className="flex-1 truncate">{task.title}</span>
              <DateRangeBadge
                startDate={task.startDate}
                dueDate={task.dueDate}
                status={task.status}
              />
              <span className="shrink-0 text-muted-foreground">
                {task.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
