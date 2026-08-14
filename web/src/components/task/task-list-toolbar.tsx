import { Button } from '#components/ui/button'
import { GithubMarkIcon } from '#components/ui/github-mark-icon'
import { KeybindHint } from '#components/ui/keybind-hint'
import { newTaskKeybinding } from '#lib/keybindings'

interface TaskListToolbarProps {
  onCreateFromGithub: () => void
  onCreateNew: () => void
}

export function TaskListToolbar({
  onCreateFromGithub,
  onCreateNew,
}: TaskListToolbarProps) {
  return (
    <div className="ml-auto flex items-center gap-2">
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
