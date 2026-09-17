import { TaskPreviewChip } from '#components/task/task-preview-chip'
import { useTaskMentionPreview } from '#hooks/use-task-mentions'
import type { TaskMentionData } from '#lib/inline-reference/providers/task-mention'

export function TaskMentionChip({
  data,
  raw,
  defaultOpen,
}: {
  data: TaskMentionData
  raw: string
  defaultOpen?: boolean | undefined
}) {
  const { data: task } = useTaskMentionPreview(data.number)
  return (
    <TaskPreviewChip task={task ?? null} raw={raw} defaultOpen={defaultOpen} />
  )
}
