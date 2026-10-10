import { Link } from '@tanstack/react-router'
import type { Ref } from 'react'

import { DateRangeBadge } from '#components/task/task-row-shared'
import { ListAreaMessage } from '#components/ui/list-area-message'
import { SectionHeading } from '#components/ui/section-heading'
import type { Task } from '#hooks/use-tasks'

type GeneratedTaskListItem = Pick<
  Task,
  'id' | 'number' | 'title' | 'startDate' | 'dueDate' | 'status'
>

interface GeneratedTasksListAppearanceProps {
  tasks: GeneratedTaskListItem[]
  isLoading: boolean
  isError: boolean
  hasNextPage: boolean
  isFetchingNextPage: boolean
  isFetchNextPageError: boolean
  sentinelRef?: Ref<HTMLDivElement> | undefined
  onRetry?: (() => void) | undefined
}

export function GeneratedTasksListAppearance({
  tasks,
  isLoading,
  isError,
  hasNextPage,
  isFetchingNextPage,
  isFetchNextPageError,
  sentinelRef,
  onRetry,
}: GeneratedTasksListAppearanceProps) {
  return (
    <div className="flex flex-col gap-2.5">
      <SectionHeading level={3}>Generated tasks</SectionHeading>
      {isLoading ? (
        <ListAreaMessage>Loading...</ListAreaMessage>
      ) : isError && tasks.length === 0 ? (
        <p className="font-mono text-xs text-destructive">
          Failed to load generated tasks.
        </p>
      ) : tasks.length === 0 ? (
        <ListAreaMessage>No tasks generated yet.</ListAreaMessage>
      ) : (
        <div className="border border-border">
          {tasks.map((task) => (
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
          {hasNextPage && <div ref={sentinelRef} aria-hidden />}
          {isFetchingNextPage && (
            <ListAreaMessage>Loading more...</ListAreaMessage>
          )}
          {isFetchNextPageError && (
            <div
              role="alert"
              className="flex items-center justify-between border-t border-border p-2 font-mono text-xs text-destructive"
            >
              <span>Failed to load more generated tasks.</span>
              <button
                type="button"
                onClick={onRetry}
                className="underline underline-offset-2"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
