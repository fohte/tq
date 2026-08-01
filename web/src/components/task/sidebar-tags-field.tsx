import { SidebarField } from '#components/task/sidebar-field'
import { TagsInput } from '#components/task/tags-input'
import { useUpdateTask } from '#hooks/use-tasks'

export function SidebarTagsField({
  taskId,
  labels,
}: {
  taskId: string
  labels: string[]
}) {
  const updateTask = useUpdateTask()

  return (
    <SidebarField label="TAGS">
      <TagsInput
        labels={labels}
        onLabelsChange={(next) => {
          updateTask.mutate({ id: taskId, input: { labels: next } })
        }}
      />
    </SidebarField>
  )
}
