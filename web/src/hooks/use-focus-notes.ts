import { useEffect, useState } from 'react'

const PERSIST_DEBOUNCE_MS = 300

function storageKey(taskId: string): string {
  return `tq:focus-notes:${taskId}`
}

function readNotes(taskId: string): string {
  try {
    return localStorage.getItem(storageKey(taskId)) ?? ''
  } catch {
    return ''
  }
}

/**
 * Work notes for Focus mode aren't backed by a DB column (tasks only have a
 * WYSIWYG `description`), so they're persisted client-side per task.
 */
export function useFocusNotes(taskId: string) {
  const [notes, setNotes] = useState(() => readNotes(taskId))

  useEffect(() => {
    setNotes(readNotes(taskId))
  }, [taskId])

  // Debounced so rapid typing doesn't write to localStorage on every keystroke.
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        localStorage.setItem(storageKey(taskId), notes)
      } catch {
        // best-effort persistence; keep the in-memory value even if storage write fails
      }
    }, PERSIST_DEBOUNCE_MS)

    return () => {
      clearTimeout(timeoutId)
    }
  }, [notes, taskId])

  return [notes, setNotes] as const
}
