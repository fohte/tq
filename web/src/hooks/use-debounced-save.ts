import { useCallback, useEffect, useRef } from 'react'

export const DEBOUNCED_SAVE_DELAY_MS = 1000

/**
 * Debounces calls to `save`, coalescing rapid edits (e.g. keystrokes) into a
 * single call after `delayMs` of inactivity. `flush` runs a pending save
 * immediately; `cancel` drops it without saving. Both are safe to call when
 * there is no pending save.
 */
export function useDebouncedSave(
  save: (value: string) => void,
  delayMs: number = DEBOUNCED_SAVE_DELAY_MS,
) {
  const saveRef = useRef(save)
  saveRef.current = save
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingSaveRef = useRef<(() => void) | null>(null)

  const onChange = useCallback(
    (value: string) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      // Lock in the save callback active at schedule time, not whatever is
      // current when the timer fires — a later render (e.g. after
      // navigating to a different entity without unmounting) must not
      // redirect an already-pending save.
      const currentSave = saveRef.current
      const doSave = () => {
        currentSave(value)
        pendingSaveRef.current = null
      }
      pendingSaveRef.current = doSave
      timeoutRef.current = setTimeout(doSave, delayMs)
    },
    [delayMs],
  )

  const flush = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    pendingSaveRef.current?.()
    pendingSaveRef.current = null
  }, [])

  const cancel = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    pendingSaveRef.current = null
  }, [])

  useEffect(() => {
    return () => {
      flush()
    }
  }, [flush])

  return { onChange, flush, cancel }
}
