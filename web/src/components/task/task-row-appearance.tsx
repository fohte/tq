import { Link } from '@tanstack/react-router'
import { ListChecks } from 'lucide-react'

import { SessionIndicator } from '#components/agent-session/session-indicator'
import { GithubLinksChipGroup } from '#components/task/github-links-chip-group'
import { TaskStatusGlyph } from '#components/task/status-icon'
import {
  BlockedByLabel,
  CloseReasonLabel,
  DateRangeBadge,
  ParentTaskLabel,
  RecurrenceLabel,
  RemindBadge,
  ROW_INDENT_CLASS_NAME,
  rowIndentValue,
  rowTitleClassName,
  rowWrapperClassName,
  TagTokens,
  TaskContextLabel,
  TaskNumberLabel,
  TaskProjectLabel,
} from '#components/task/task-row-shared'
import { DotSeparatedList } from '#components/ui/dot-separated-list'
import type { TaskAgentSession } from '#hooks/use-task-agent-sessions'
import type { Task } from '#hooks/use-tasks'
import { cn } from '#lib/utils'

export interface TaskRowAppearanceProps {
  task: Task
  sessions?: TaskAgentSession[]
  depth?: number
  selected?: boolean
  trailing?: React.ReactNode
  titleContent?: React.ReactNode
  belowMetadata?: React.ReactNode
  metadataLeading?: React.ReactNode
  showChildCompletionCount?: boolean
  onClick?: (e: React.MouseEvent) => void
  draggable?: boolean
  // Appended after the row's canonical second-line items (labels, project,
  // context, parent, dateRange, remindAt, recurrence, githubLink,
  // closeReason, blockedBy) — keep their order intact.
  secondLineExtras?: React.ReactNode[]
  isCurrentTimeBlock?: boolean
  size?: 'default' | 'large'
  checklistCompletionCountPlacement?: 'title' | 'metadata'
}

// Shared row body: status glyph + number/title line + a dot-separated
// metadata line. Used as-is by flat lists (project open-tasks panel,
// today's queue) and wrapped with indent/dnd by TreeTaskGridRow, which
// injects its expand toggle at the start of the metadata line.
export function TaskRowAppearance({
  task,
  sessions = [],
  depth = 0,
  selected = false,
  trailing,
  titleContent,
  belowMetadata,
  metadataLeading,
  showChildCompletionCount = true,
  onClick,
  draggable = false,
  secondLineExtras = [],
  isCurrentTimeBlock = false,
  size = 'default',
  checklistCompletionCountPlacement = 'title',
}: TaskRowAppearanceProps) {
  const isCompleted = task.status === 'completed'
  const completedReason = isCompleted
    ? (task.statusReason ?? 'completed')
    : null
  const closeReason =
    completedReason != null && completedReason !== 'completed'
      ? completedReason
      : null
  const checklistProgress = task.checklistCompletionCount
  const checklistCompletionCount =
    checklistProgress.total === 0 ? null : (
      <span
        className="inline-flex shrink-0 items-center gap-1 font-mono text-xs text-muted-foreground"
        data-testid="checklist-completion"
        aria-label={`${String(checklistProgress.completed)} of ${String(checklistProgress.total)} checklist items completed`}
      >
        <ListChecks className="size-3.5" aria-hidden="true" />
        {checklistProgress.completed}/{checklistProgress.total}
      </span>
    )

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
    task.startDate != null || task.dueDate != null ? (
      <DateRangeBadge
        startDate={task.startDate}
        dueDate={task.dueDate}
        status={task.status}
      />
    ) : null,
    task.remindAt != null ? <RemindBadge remindAt={task.remindAt} /> : null,
    task.recurrenceRule != null ? (
      <RecurrenceLabel
        rule={task.recurrenceRule}
        templateId={task.templateId}
      />
    ) : null,
    task.githubLinks.length > 0 ? (
      <GithubLinksChipGroup links={task.githubLinks} />
    ) : null,
    closeReason != null ? (
      <CloseReasonLabel
        reason={closeReason}
        duplicateOfNumber={task.duplicateOfNumber}
      />
    ) : null,
    task.blockedByNumbers.length + task.blockedByGithubRefs.length > 0 ? (
      <BlockedByLabel
        blockedByNumbers={task.blockedByNumbers}
        blockedByGithubRefs={task.blockedByGithubRefs}
      />
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
          }
        : {})}
    >
      <div
        className={cn(
          'group',
          rowWrapperClassName(isCompleted),
          isCurrentTimeBlock && 'bg-accent hover:bg-accent',
          size === 'large' && 'py-3',
          // Must come after rowWrapperClassName: twMerge keeps
          // both px-* and a later pl-* (CSS cascade lets pl-* win),
          // but drops pl-* if it precedes the conflicting px-*.
          ROW_INDENT_CLASS_NAME,
          selected && 'ring-1 ring-inset ring-border-strong',
        )}
        style={
          {
            '--row-indent': rowIndentValue(depth),
          } as React.CSSProperties & { '--row-indent': string }
        }
      >
        <div className="flex items-start gap-2" onClick={onClick}>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-baseline gap-2">
              <TaskStatusGlyph
                status={task.status}
                statusReason={task.statusReason}
              />
              <TaskNumberLabel number={task.number} />
              <span
                className={cn(
                  rowTitleClassName(isCompleted),
                  size === 'large' && 'text-base',
                  'min-w-16',
                )}
              >
                {titleContent ?? task.title}
              </span>
              {showChildCompletionCount &&
                task.childCompletionCount.total > 0 && (
                  <span
                    className="shrink-0 font-mono text-xs text-muted-foreground"
                    data-testid="child-completion"
                  >
                    {task.childCompletionCount.completed}/
                    {task.childCompletionCount.total}
                  </span>
                )}
              {checklistCompletionCountPlacement === 'title' &&
                checklistCompletionCount}
              <SessionIndicator sessions={sessions} />
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {metadataLeading}
              {checklistCompletionCountPlacement === 'metadata' &&
                checklistCompletionCount}
              <DotSeparatedList items={secondLineItems} />
            </div>
            {belowMetadata}
          </div>

          {trailing != null && (
            <div className="shrink-0 self-center">{trailing}</div>
          )}
        </div>
      </div>
    </Link>
  )
}
