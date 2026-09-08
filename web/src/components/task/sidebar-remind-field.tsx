import {
  fieldValueClassName,
  SidebarField,
} from '#components/task/sidebar-field'
import { Input } from '#components/ui/input'
import { useUpdateTask } from '#hooks/use-tasks'

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

// `datetime-local` speaks local wall-clock time with no zone, while the API
// stores an instant.
function toInputValue(remindAt: string | null): string {
  if (remindAt == null) return ''

  const date = new Date(remindAt)
  return `${String(date.getFullYear())}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

export function SidebarRemindField({
  taskId,
  remindAt,
}: {
  taskId: string
  remindAt: string | null
}) {
  const updateTask = useUpdateTask()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    updateTask.mutate({
      id: taskId,
      input: {
        remindAt: value === '' ? null : new Date(value).toISOString(),
      },
    })
  }

  return (
    <SidebarField label="REMIND">
      <Input
        type="datetime-local"
        value={toInputValue(remindAt)}
        onChange={handleChange}
        className={fieldValueClassName}
      />
    </SidebarField>
  )
}
