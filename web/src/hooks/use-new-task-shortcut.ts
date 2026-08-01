import { useEffect } from 'react'

const NEW_TASK_SHORTCUT_EVENT = 'tq:new-task-shortcut'

// The `n` shortcut always navigates to /tasks first (see use-global-keybindings.ts),
// so the tasks list route listens for this event to open its own create form
// instead of duplicating that form behind a second, globally-mounted modal.
export function dispatchNewTaskShortcut() {
  window.dispatchEvent(new Event(NEW_TASK_SHORTCUT_EVENT))
}

export function useNewTaskShortcutListener(onTrigger: () => void) {
  useEffect(() => {
    window.addEventListener(NEW_TASK_SHORTCUT_EVENT, onTrigger)
    return () => {
      window.removeEventListener(NEW_TASK_SHORTCUT_EVENT, onTrigger)
    }
  }, [onTrigger])
}
