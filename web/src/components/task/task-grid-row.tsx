import { Link } from '@tanstack/react-router'

import { GithubLinkBadge } from '#components/task/github-link-badge'
import {
  ContextBadge,
  DueDateBadge,
  GridEstimate,
  gridRowTitleClassName,
  gridRowWrapperClassName,
  TagTokens,
  TaskNumberLabel,
  useHandleStatusChange,
} from '#components/task/task-row-shared'
import { TaskStatusPicker } from '#components/task/task-status-picker'
import type { Task } from '#hooks/use-tasks'

export function TaskGridRow({ task }: { task: Task }) {
  const handleStatusChange = useHandleStatusChange(task.id, task.status)
  const isInProgress = task.status === 'in_progress'
  const isCompleted = task.status === 'completed'

  return (
    <Link to="/tasks/$taskId" params={{ taskId: task.id }} className="block">
      <div className={gridRowWrapperClassName(isInProgress, isCompleted)}>
        {/* Desktop: single-row grid matching the column header */}
        <div className="hidden grid-cols-(--task-row-columns) items-center gap-2 md:grid">
          <span />
          <TaskStatusPicker
            status={task.status}
            onStatusChange={handleStatusChange}
          />

          <div className="flex min-w-0 items-center gap-2 overflow-hidden">
            <TaskNumberLabel number={task.number} />
            <span className={gridRowTitleClassName(isInProgress, isCompleted)}>
              {task.title}
            </span>
            <ContextBadge context={task.context} />
            {task.parentNumber != null && (
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                ← #{task.parentNumber}
              </span>
            )}
          </div>

          <div className="overflow-hidden">
            {task.labels.length > 0 && (
              <TagTokens labels={task.labels} isCompleted={isCompleted} />
            )}
          </div>

          <div>
            {task.githubLink != null && (
              <GithubLinkBadge link={task.githubLink} />
            )}
          </div>

          <div>
            {task.estimatedMinutes != null && (
              <GridEstimate
                estimatedMinutes={task.estimatedMinutes}
                isCompleted={isCompleted}
              />
            )}
          </div>

          <div className="text-right">
            {task.dueDate != null && (
              <DueDateBadge dueDate={task.dueDate} status={task.status} />
            )}
          </div>

          {/* Empty trailing cell — keeps this grid aligned with TreeTaskGridRow's
              row-actions column, which this flat (backlog) row doesn't render. */}
          <div />
        </div>

        {/* Mobile: two-line stack */}
        <div className="flex items-start gap-2 md:hidden">
          <TaskStatusPicker
            status={task.status}
            onStatusChange={handleStatusChange}
          />

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className={gridRowTitleClassName(isInProgress, isCompleted)}>
              {task.title}
            </span>
            <div className="flex items-center gap-1.5 overflow-hidden">
              <TaskNumberLabel number={task.number} />
              <ContextBadge context={task.context} />
              {task.labels.length > 0 && (
                <TagTokens labels={task.labels} isCompleted={isCompleted} />
              )}
              <div className="ml-auto flex shrink-0 items-center gap-1.5">
                {task.dueDate != null && (
                  <DueDateBadge dueDate={task.dueDate} status={task.status} />
                )}
                {task.estimatedMinutes != null && (
                  <GridEstimate
                    estimatedMinutes={task.estimatedMinutes}
                    isCompleted={isCompleted}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
