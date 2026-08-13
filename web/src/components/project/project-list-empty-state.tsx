import { FolderKanban } from 'lucide-react'

import { Button } from '#components/ui/button'

export function ProjectListEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <FolderKanban className="size-10 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground">No projects yet</p>
      <Button variant="outline" onClick={onCreate}>
        Create your first project
      </Button>
    </div>
  )
}
