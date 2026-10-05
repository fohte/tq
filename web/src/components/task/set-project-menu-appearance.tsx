import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@fohte/ui/dialog'
import { List, ListItem } from '@fohte/ui/list'

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

        <div className="max-h-72 overflow-y-auto text-popover-foreground">
          <List>
            <ListItem
              onSelect={() => {
                onSelectProject(null)
              }}
            >
              —
            </ListItem>
            {projects.map((project) => (
              <ListItem
                key={project.id}
                onSelect={() => {
                  onSelectProject(project.id)
                }}
              >
                {project.title}
              </ListItem>
            ))}
          </List>
        </div>
      </DialogContent>
    </Dialog>
  )
}
