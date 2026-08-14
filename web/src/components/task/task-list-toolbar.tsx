import { Button } from '#components/ui/button'
import { Checkbox } from '#components/ui/checkbox'
import { GithubMarkIcon } from '#components/ui/github-mark-icon'
import { KeybindHint } from '#components/ui/keybind-hint'
import type { Project } from '#hooks/use-projects'
import type { TaskSortBy } from '#hooks/use-tasks'
import { selectHandler } from '#lib/form-utils'
import { newTaskKeybinding } from '#lib/keybindings'
import { sortOptionValues } from '#lib/tasks-query'

const sortLabels: Record<TaskSortBy, string> = {
  updated: 'Updated',
  created: 'Created',
}

interface TaskListToolbarProps {
  showCompleted: boolean
  onShowCompletedChange: (checked: boolean) => void
  sortBy: TaskSortBy
  onSortByChange: (sortBy: TaskSortBy) => void
  projects: Project[]
  projectId: string | undefined
  onProjectIdChange: (id: string) => void
  onCreateFromGithub: () => void
  onCreateNew: () => void
}

export function TaskListToolbar({
  showCompleted,
  onShowCompletedChange,
  sortBy,
  onSortByChange,
  projects,
  projectId,
  onProjectIdChange,
  onCreateFromGithub,
  onCreateNew,
}: TaskListToolbarProps) {
  const projectIdValues = ['', ...projects.map((project) => project.id)]

  return (
    <div className="ml-auto flex items-center gap-2">
      <label className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground">
        <Checkbox
          checked={showCompleted}
          onCheckedChange={onShowCompletedChange}
        />
        show completed
      </label>
      <select
        value={sortBy}
        onChange={selectHandler(onSortByChange, sortOptionValues)}
        className="bg-transparent px-2 py-1 font-mono text-xs text-muted-foreground outline-none hover:text-foreground"
        aria-label="Sort tasks"
      >
        {sortOptionValues.map((sort) => (
          <option key={sort} value={sort}>
            Sort: {sortLabels[sort]}
          </option>
        ))}
      </select>
      <select
        value={projectId ?? ''}
        onChange={selectHandler(onProjectIdChange, projectIdValues)}
        className="bg-transparent px-2 py-1 font-mono text-xs text-muted-foreground outline-none hover:text-foreground"
        aria-label="Filter by project"
      >
        <option value="">All projects</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.title}
          </option>
        ))}
      </select>
      <Button
        type="button"
        variant="secondary"
        size="xs"
        onClick={onCreateFromGithub}
        aria-label="Create task from GitHub"
      >
        <GithubMarkIcon className="size-3" />
        <span className="hidden md:inline">from issue</span>
      </Button>
      <Button
        type="button"
        size="xs"
        className="hidden md:inline-flex"
        onClick={onCreateNew}
      >
        + new
        <KeybindHint className="text-muted-foreground">
          {newTaskKeybinding.keys}
        </KeybindHint>
      </Button>
    </div>
  )
}
