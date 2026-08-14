import { Link } from '@tanstack/react-router'

import { TaskMentionSummary } from '#components/task/task-mention-summary'
import {
  PreviewCard,
  PreviewCardPopup,
  PreviewCardPortal,
  PreviewCardPositioner,
  PreviewCardTrigger,
} from '#components/ui/preview-card'
import { useTaskUrlPreview } from '#hooks/use-task-url-preview'
import type { TaskUrlData } from '#lib/inline-reference/providers/task-url'

export function TaskUrlChip({ data, raw }: { data: TaskUrlData; raw: string }) {
  const { data: task } = useTaskUrlPreview(data.url)

  if (task == null) return <span>{raw}</span>

  return (
    <PreviewCard>
      <PreviewCardTrigger
        render={<span />}
        className="inline-flex cursor-text items-center gap-1 border border-border bg-secondary/50 px-1.5 py-0.5 align-baseline text-sm leading-none"
      >
        <TaskMentionSummary
          status={task.status}
          number={task.number}
          title={task.title}
          titleClassName="max-w-48"
        />
      </PreviewCardTrigger>
      <PreviewCardPortal>
        <PreviewCardPositioner>
          <PreviewCardPopup>
            <Link
              to="/tasks/$taskId"
              params={{ taskId: task.id }}
              className="flex flex-col gap-1.5"
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                <TaskMentionSummary
                  status={task.status}
                  number={task.number}
                  title={task.title}
                />
              </div>
              {task.description != null && task.description !== '' && (
                <p className="line-clamp-3 text-xs text-muted-foreground">
                  {task.description}
                </p>
              )}
            </Link>
          </PreviewCardPopup>
        </PreviewCardPositioner>
      </PreviewCardPortal>
    </PreviewCard>
  )
}
