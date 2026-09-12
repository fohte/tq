import { Link } from '@tanstack/react-router'
import { Repeat } from 'lucide-react'

import { Button } from '#components/ui/button'
import { KeybindHint } from '#components/ui/keybind-hint'
import { newTaskKeybinding } from '#lib/keybindings'

interface TaskListToolbarProps {
  onCreateNew: () => void
}

export function TaskListToolbar({ onCreateNew }: TaskListToolbarProps) {
  return (
    <div className="ml-auto flex items-center gap-2">
      <Link
        to="/recurring"
        className="inline-flex items-center gap-1 font-mono text-2xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <Repeat className="size-3" />
        recurring
      </Link>
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
