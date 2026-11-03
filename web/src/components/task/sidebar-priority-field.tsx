import { PrioritySelect } from '#components/task/priority-select'
import { SidebarField } from '#components/task/sidebar-field'
import type { TaskPriority } from '#hooks/use-priority-settings'
import { usePrioritySettings } from '#hooks/use-priority-settings'
import { useUpdateTask } from '#hooks/use-tasks'

export function SidebarPriorityField({
  taskId,
  priority,
}: {
  taskId: string
  priority: TaskPriority
}) {
  const settings = usePrioritySettings()
  const updateTask = useUpdateTask()

  return (
    <SidebarField label="PRIORITY">
      <div className="px-1">
        <PrioritySelect
          value={priority}
          settings={settings.data}
          onValueChange={(nextPriority) => {
            updateTask.mutate({ id: taskId, input: { priority: nextPriority } })
          }}
          className="w-full justify-start"
        />
      </div>
    </SidebarField>
  )
}
