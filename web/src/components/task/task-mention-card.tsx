import { TaskPreviewCard } from '#components/task/task-preview-card'
import { useTaskMentionPreview } from '#hooks/use-task-mentions'
import type { TaskMentionData } from '#lib/inline-reference/providers/task-mention'

export function TaskMentionCard({
  data,
  raw,
}: {
  data: TaskMentionData
  raw: string
}) {
  const { data: task } = useTaskMentionPreview(data.number)
  return <TaskPreviewCard task={task ?? null} raw={raw} />
}
