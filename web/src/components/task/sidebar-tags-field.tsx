import { SidebarField } from '#components/task/sidebar-field'
import { TagsInput } from '#components/task/tags-input'
import { useUpdateTask } from '#hooks/use-tasks'

export function SidebarTagsField({
  taskId,
  context,
  labels,
}: {
  taskId: string
  context: 'work' | 'personal'
  labels: string[]
}) {
  const updateTask = useUpdateTask()

  return (
    <SidebarField label="TAGS">
      <TagsInput
        labels={labels}
        context={context}
        onLabelsChange={(next) => {
          updateTask.mutate({ id: taskId, input: { labels: next } })
        }}
      />
    </SidebarField>
  )
}
