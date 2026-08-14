import { TaskPreviewCard } from '#components/task/task-preview-card'
import { useTaskUrlPreview } from '#hooks/use-task-url-preview'
import type { TaskUrlData } from '#lib/inline-reference/providers/task-url'

export function TaskUrlCard({ data, raw }: { data: TaskUrlData; raw: string }) {
  const { data: task } = useTaskUrlPreview(data.url)
  return <TaskPreviewCard task={task ?? null} raw={raw} />
}
