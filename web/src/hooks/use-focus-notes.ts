import { useEffect, useState } from 'react'

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
  const [notes, setNotesState] = useState(() => readNotes(taskId))

  useEffect(() => {
    setNotesState(readNotes(taskId))
  }, [taskId])

  const setNotes = (value: string) => {
    setNotesState(value)
    try {
      localStorage.setItem(storageKey(taskId), value)
    } catch {
      // best-effort persistence; keep the in-memory value even if storage write fails
    }
  }

  return [notes, setNotes] as const
}
