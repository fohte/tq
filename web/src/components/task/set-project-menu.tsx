import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '#components/ui/dialog'
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
  const { data: projects } = useProjects(undefined, { enabled: open })
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{`Set project for #${String(taskNumber)}`}</DialogTitle>
        </DialogHeader>

        <div className="max-h-72 overflow-y-auto">
          <button
            type="button"
            className="flex min-h-11 w-full items-center px-3 text-left text-sm text-popover-foreground hover:bg-accent/50"
            onClick={() => {
              selectProject(null)
            }}
          >
            —
          </button>
          {(projects ?? []).map((project) => (
            <button
              key={project.id}
              type="button"
              className="flex min-h-11 w-full items-center px-3 text-left text-sm text-popover-foreground hover:bg-accent/50"
              onClick={() => {
                selectProject(project.id)
              }}
            >
              {project.title}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
