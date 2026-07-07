import { useEffect, useState } from 'react'

function storageKey(taskId: string): string {
  return `tq:focus-notes:${taskId}`
}

/**
 * Work notes for Focus mode aren't backed by a DB column (tasks only have a
 * WYSIWYG `description`), so they're persisted client-side per task.
 */
export function useFocusNotes(taskId: string) {
  const [notes, setNotesState] = useState(
    () => localStorage.getItem(storageKey(taskId)) ?? '',
  )

  useEffect(() => {
    setNotesState(localStorage.getItem(storageKey(taskId)) ?? '')
  }, [taskId])

  const setNotes = (value: string) => {
    setNotesState(value)
    localStorage.setItem(storageKey(taskId), value)
  }

  return [notes, setNotes] as const
}
