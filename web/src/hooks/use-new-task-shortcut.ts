import { useEffect } from 'react'

const NEW_TASK_SHORTCUT_EVENT = 'tq:new-task-shortcut'

// dispatchNewTaskShortcut() runs from a `navigate().then()` microtask (see
// use-global-keybindings.ts), which resolves before the destination route's
// mount effect runs, so the live DOM event can fire before any listener is
// attached. This flag lets a listener that mounts afterwards catch up.
let pendingTrigger = false

// The `n` shortcut always navigates to /tasks first (see use-global-keybindings.ts),
// so the tasks list route listens for this event to open its own create form.
export function dispatchNewTaskShortcut() {
  pendingTrigger = true
  window.dispatchEvent(new Event(NEW_TASK_SHORTCUT_EVENT))
}

export function useNewTaskShortcutListener(onTrigger: () => void) {
  useEffect(() => {
    const handleTrigger = () => {
      pendingTrigger = false
      onTrigger()
    }

    if (pendingTrigger) {
      handleTrigger()
    }

    window.addEventListener(NEW_TASK_SHORTCUT_EVENT, handleTrigger)
    return () => {
      window.removeEventListener(NEW_TASK_SHORTCUT_EVENT, handleTrigger)
    }
  }, [onTrigger])
}
