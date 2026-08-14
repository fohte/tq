import { Chip } from '#components/ui/chip'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '#components/ui/dropdown-menu'
import type { Project } from '#hooks/use-projects'
import type { TaskSortBy } from '#hooks/use-tasks'
import { sortOptionValues } from '#lib/tasks-query'

const sortLabels: Record<TaskSortBy, string> = {
  updated: 'Updated',
  created: 'Created',
}

interface TaskFilterChipRowProps {
  showCompleted: boolean
  onShowCompletedChange: (checked: boolean) => void
  sortBy: TaskSortBy
  onSortByChange: (sortBy: TaskSortBy) => void
  projects: Project[]
  projectId: string | undefined
  onProjectIdChange: (id: string) => void
}

export function TaskFilterChipRow({
  showCompleted,
  onShowCompletedChange,
  sortBy,
  onSortByChange,
  projects,
  projectId,
  onProjectIdChange,
}: TaskFilterChipRowProps) {
  const selectedProject = projects.find((project) => project.id === projectId)

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border px-3 py-2">
      {!showCompleted && (
        <Chip
          as="button"
          active
          className="shrink-0"
          onClick={() => {
            onShowCompletedChange(true)
          }}
        >
          not completed ×
        </Chip>
      )}
      <Chip active className="shrink-0">
        sort: {sortLabels[sortBy]}
      </Chip>
      {selectedProject != null && (
        <Chip
          as="button"
          active
          className="shrink-0"
          onClick={() => {
            onProjectIdChange('')
          }}
        >
          project: {selectedProject.title} ×
        </Chip>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex shrink-0 cursor-pointer items-center gap-1 border border-border px-1 font-mono text-2xs text-muted-foreground outline-none hover:text-foreground">
          + filter
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuCheckboxItem
            checked={showCompleted}
            onCheckedChange={onShowCompletedChange}
          >
            show completed
          </DropdownMenuCheckboxItem>
          <DropdownMenuRadioGroup value={sortBy} onValueChange={onSortByChange}>
            {sortOptionValues.map((sort) => (
              <DropdownMenuRadioItem key={sort} value={sort}>
                Sort: {sortLabels[sort]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          {projects.length > 0 && (
            <DropdownMenuRadioGroup
              value={projectId ?? ''}
              onValueChange={onProjectIdChange}
            >
              <DropdownMenuRadioItem value="">
                All projects
              </DropdownMenuRadioItem>
              {projects.map((project) => (
                <DropdownMenuRadioItem key={project.id} value={project.id}>
                  {project.title}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
