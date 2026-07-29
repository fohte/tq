import { StatusIcon } from '#components/task/task-row'
import {
  PreviewCard,
  PreviewCardPopup,
  PreviewCardPortal,
  PreviewCardPositioner,
  PreviewCardTrigger,
} from '#components/ui/preview-card'
import { useTaskMentionPreview } from '#hooks/use-task-mentions'
import type { TaskMentionData } from '#lib/inline-reference/providers/task-mention'

// Only ever mounted once the plugin has confirmed the task is already
// resolved in the query cache, so this never needs to render a loading or
// not-found state itself.
export function TaskMentionChip({ data }: { data: TaskMentionData }) {
  const { data: task } = useTaskMentionPreview(data.number)

  if (task == null) return null

  return (
    <PreviewCard>
      <PreviewCardTrigger
        render={<span />}
        className="inline-flex cursor-text items-center gap-1 rounded border border-border bg-secondary/50 px-1.5 py-0.5 align-baseline text-sm leading-none"
      >
        <StatusIcon status={task.status} />
        <span className="text-muted-foreground">#{task.number}</span>
        <span className="max-w-48 truncate">{task.title}</span>
      </PreviewCardTrigger>
      <PreviewCardPortal>
        <PreviewCardPositioner>
          <PreviewCardPopup>
            {/* A plain anchor, not @tanstack/react-router's Link: this chip
                is mounted into its own React root inside a ProseMirror
                decoration, outside the app's RouterProvider tree, so Link's
                useRouter() would throw. */}
            <a href={`/tasks/${task.id}`} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 text-sm font-medium">
                <StatusIcon status={task.status} />
                <span className="text-muted-foreground">#{task.number}</span>
                <span className="truncate">{task.title}</span>
              </div>
              {task.description != null && task.description !== '' && (
                <p className="line-clamp-3 text-xs text-muted-foreground">
                  {task.description}
                </p>
              )}
            </a>
          </PreviewCardPopup>
        </PreviewCardPositioner>
      </PreviewCardPortal>
    </PreviewCard>
  )
}
