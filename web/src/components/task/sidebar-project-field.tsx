import {
  fieldValueClassName,
  SidebarField,
} from '#components/task/sidebar-field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#components/ui/select'
import { useProjects } from '#hooks/use-projects'
import { useUpdateTask } from '#hooks/use-tasks'

const NO_PROJECT = '__none__'

export function SidebarProjectField({
  taskId,
  projectId,
}: {
  taskId: string
  projectId: string | null
}) {
  const { data: projects } = useProjects()
  const updateTask = useUpdateTask()

  const items = [
    { value: NO_PROJECT, label: '—' },
    ...(projects ?? []).map((project) => ({
      value: project.id,
      label: project.title,
    })),
  ]

  return (
    <SidebarField label="PROJECT">
      <Select
        items={items}
        value={projectId ?? NO_PROJECT}
        onValueChange={(value) => {
          if (value == null) return
          updateTask.mutate({
            id: taskId,
            input: { projectId: value === NO_PROJECT ? null : value },
          })
        }}
      >
        <SelectTrigger size="sm" className={fieldValueClassName}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_PROJECT}>—</SelectItem>
          {(projects ?? []).map((project) => (
            <SelectItem key={project.id} value={project.id}>
              {project.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </SidebarField>
  )
}
