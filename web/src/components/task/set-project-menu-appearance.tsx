import { Button } from '@fohte/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@fohte/ui/dialog'

import type { Project } from '#hooks/use-projects'

export function SetProjectMenuAppearance({
  open,
  onOpenChange,
  taskNumber,
  projects,
  onSelectProject,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  taskNumber: number
  projects: Project[]
  onSelectProject: (projectId: string | null) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{`Set project for #${String(taskNumber)}`}</DialogTitle>
        </DialogHeader>

        <div className="max-h-72 overflow-y-auto">
          <Button
            type="button"
            variant="ghost"
            className="h-auto min-h-0 shrink justify-start whitespace-normal gap-0 rounded-none border-0 bg-transparent p-0 font-inherit font-normal shadow-none transition-none hover:bg-transparent active:translate-y-0 flex min-h-11 w-full items-center px-3 text-left text-sm text-popover-foreground hover:bg-accent/50 focus:outline-auto focus-visible:ring-0"
            onClick={() => {
              onSelectProject(null)
            }}
          >
            —
          </Button>
          {projects.map((project) => (
            <Button
              key={project.id}
              type="button"
              variant="ghost"
              className="h-auto min-h-0 shrink justify-start whitespace-normal gap-0 rounded-none border-0 bg-transparent p-0 font-inherit font-normal shadow-none transition-none hover:bg-transparent active:translate-y-0 flex min-h-11 w-full items-center px-3 text-left text-sm text-popover-foreground hover:bg-accent/50 focus:outline-auto focus-visible:ring-0"
              onClick={() => {
                onSelectProject(project.id)
              }}
            >
              {project.title}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
