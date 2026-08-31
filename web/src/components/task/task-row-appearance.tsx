import { Link } from '@tanstack/react-router'

import { SessionIndicator } from '#components/agent-session/session-indicator'
import { GithubLinksChipGroup } from '#components/task/github-links-chip-group'
import {
  DueDateBadge,
  EstimateLabel,
  ParentTaskLabel,
  ROW_INDENT_CLASS_NAME,
  rowIndentStyle,
  rowTitleClassName,
  rowWrapperClassName,
  StartDateBadge,
  TagTokens,
  TaskContextLabel,
  TaskNumberLabel,
  TaskProjectLabel,
  useHandleStatusChange,
} from '#components/task/task-row-shared'
import { TaskStatusPicker } from '#components/task/task-status-picker'
import { DotSeparatedList } from '#components/ui/dot-separated-list'
import type { TaskAgentSession } from '#hooks/use-task-agent-sessions'
import type { Task } from '#hooks/use-tasks'
import { cn } from '#lib/utils'

export interface TaskRowAppearanceProps {
  task: Task
  sessions?: TaskAgentSession[]
  depth?: number
  selected?: boolean
  leading?: React.ReactNode
  trailing?: React.ReactNode
  onClick?: (e: React.MouseEvent) => void
  draggable?: boolean
  // Appended after the row's canonical second-line items (labels, project,
  // context, parent, startDate, dueDate, estimate, githubLink) — keep their
  // order intact.
  secondLineExtras?: React.ReactNode[]
}

// Shared row body: status picker + number/title line + a dot-separated
// metadata line. Used as-is by flat lists (project open-tasks panel,
// today's queue) and wrapped with caret/indent/dnd by TreeTaskGridRow for
// the /tasks tree.
export function TaskRowAppearance({
  task,
  sessions = [],
  depth = 0,
  selected = false,
  leading,
  trailing,
  onClick,
  draggable = false,
  secondLineExtras = [],
}: TaskRowAppearanceProps) {
  const handleStatusChange = useHandleStatusChange(task.id, task.status)
  const isCompleted = task.status === 'completed'

  const secondLineItems: React.ReactNode[] = [
    task.labels.length > 0 ? (
      <TagTokens labels={task.labels} isCompleted={isCompleted} />
    ) : null,
    task.projectId != null ? (
      <TaskProjectLabel projectId={task.projectId} />
    ) : null,
    <TaskContextLabel context={task.context} />,
    task.parentNumber != null ? (
      <ParentTaskLabel parentNumber={task.parentNumber} />
    ) : null,
    task.startDate != null ? (
      <StartDateBadge startDate={task.startDate} />
    ) : null,
    task.dueDate != null ? (
      <DueDateBadge dueDate={task.dueDate} status={task.status} />
    ) : null,
    task.estimatedMinutes != null ? (
      <EstimateLabel minutes={task.estimatedMinutes} />
    ) : null,
    task.githubLinks.length > 0 ? (
      <GithubLinksChipGroup links={task.githubLinks} />
    ) : null,
    ...secondLineExtras,
  ]

  return (
    <Link
      to="/tasks/$taskId"
      params={{ taskId: task.id }}
      className={cn('block', draggable && 'cursor-grab active:cursor-grabbing')}
      {...(draggable
        ? {
            'data-task-id': task.id,
            'data-task-title': task.title,
            ...(task.estimatedMinutes != null
              ? { 'data-estimated-minutes': String(task.estimatedMinutes) }
              : {}),
          }
        : {})}
    >
      <div
        className={cn(
          'group',
          rowWrapperClassName(isCompleted),
          // Must come after rowWrapperClassName: twMerge keeps
          // both px-* and a later pl-* (CSS cascade lets pl-* win),
          // but drops pl-* if it precedes the conflicting px-*.
          ROW_INDENT_CLASS_NAME,
          selected && 'ring-1 ring-inset ring-border-strong',
        )}
        style={rowIndentStyle(depth)}
      >
        <div className="flex items-start gap-2" onClick={onClick}>
          {leading}
          <TaskStatusPicker
            status={task.status}
            onStatusChange={handleStatusChange}
          />

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-center gap-2 overflow-hidden">
              <TaskNumberLabel number={task.number} />
              {/* min-w-30 (120px): without a floor, this flex item's
                default min-width would shrink to 0 once its siblings
                need more room than the row has, hiding the title
                entirely instead of truncating it or letting the row
                overflow. */}
              <span className={cn(rowTitleClassName(isCompleted), 'min-w-30')}>
                {task.title}
              </span>
              {task.childCompletionCount.total > 0 && (
                <span
                  className="shrink-0 font-mono text-xs text-muted-foreground"
                  data-testid="child-completion"
                >
                  {task.childCompletionCount.completed}/
                  {task.childCompletionCount.total}
                </span>
              )}
              <SessionIndicator sessions={sessions} />
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <DotSeparatedList items={secondLineItems} />
            </div>
          </div>

          {trailing != null && (
            <div className="shrink-0 self-center">{trailing}</div>
          )}
        </div>
      </div>
    </Link>
  )
}
