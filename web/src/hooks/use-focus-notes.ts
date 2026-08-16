import { Result } from 'neverthrow'
import { useEffect, useRef, useState } from 'react'

export const PERSIST_DEBOUNCE_MS = 300

function storageKey(taskId: string): string {
  return `tq:focus-notes:${taskId}`
}

const getStorageItem = Result.fromThrowable((key: string) =>
  localStorage.getItem(key),
)
const setStorageItem = Result.fromThrowable((key: string, value: string) => {
  localStorage.setItem(key, value)
})

function readNotes(taskId: string): string {
  return getStorageItem(storageKey(taskId)).unwrapOr(null) ?? ''
}

function writeNotes(taskId: string, value: string): void {
  // best-effort persistence; keep the in-memory value even if storage write fails
  setStorageItem(storageKey(taskId), value).unwrapOr(undefined)
}

/**
 * Work notes for Focus mode aren't backed by a DB column (tasks only have a
 * WYSIWYG `description`), so they're persisted client-side per task.
 */
export function useFocusNotes(taskId: string) {
  const [notes, setNotesState] = useState(() => readNotes(taskId))
  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingSaveRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    setNotesState(readNotes(taskId))

    // Flush the outgoing task's pending edit instead of dropping it.
    return () => {
      if (pendingRef.current) clearTimeout(pendingRef.current)
      pendingSaveRef.current?.()
      pendingSaveRef.current = null
    }
  }, [taskId])

  const setNotes = (value: string) => {
    setNotesState(value)
    if (pendingRef.current) clearTimeout(pendingRef.current)
    const doSave = () => {
      writeNotes(taskId, value)
      pendingSaveRef.current = null
    }
    pendingSaveRef.current = doSave
    pendingRef.current = setTimeout(doSave, PERSIST_DEBOUNCE_MS)
  }

  return [notes, setNotes] as const
}
