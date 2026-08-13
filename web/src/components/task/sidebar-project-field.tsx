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
import { selectValueHandler } from '#lib/form-utils'

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

  const projectItems = (projects ?? []).map((project) => ({
    value: project.id,
    label: project.title,
  }))
  // While useProjects() is still loading, projectId may not be in
  // projectItems yet — without an entry for it, Base UI's Select falls back
  // to rendering the raw UUID until the list arrives.
  const items = [
    { value: NO_PROJECT, label: '—' },
    ...projectItems,
    ...(projectId != null && !projectItems.some((p) => p.value === projectId)
      ? [{ value: projectId, label: '…' }]
      : []),
  ]

  return (
    <SidebarField label="PROJECT">
      <Select
        items={items}
        value={projectId ?? NO_PROJECT}
        onValueChange={selectValueHandler(
          (value) => {
            updateTask.mutate({
              id: taskId,
              input: { projectId: value === NO_PROJECT ? null : value },
            })
          },
          [NO_PROJECT, ...projectItems.map((p) => p.value)],
        )}
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
