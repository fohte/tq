import { SetProjectMenuAppearance } from '#components/task/set-project-menu-appearance'
import { useProjects } from '#hooks/use-projects'
import { useUpdateTask } from '#hooks/use-tasks'

export function SetProjectMenu({
  open,
  onOpenChange,
  taskId,
  taskNumber,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  taskId: string
  taskNumber: number
}) {
  const { data: projects } = useProjects(
    { context: 'all', status: 'all' },
    { enabled: open },
  )
  const updateTask = useUpdateTask()

  const selectProject = (projectId: string | null) => {
    updateTask.mutate(
      { id: taskId, input: { projectId } },
      {
        onSuccess: () => {
          onOpenChange(false)
        },
      },
    )
  }

  return (
    <SetProjectMenuAppearance
      open={open}
      onOpenChange={onOpenChange}
      taskNumber={taskNumber}
      projects={projects ?? []}
      onSelectProject={selectProject}
    />
  )
}
