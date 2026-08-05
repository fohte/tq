import type { KeyboardEvent, RefObject } from 'react'
import { useCallback, useEffect, useState } from 'react'

import type { SearchResult } from '#hooks/use-search'
import { useSearchTasks } from '#hooks/use-search'
import { cycleIndex } from '#lib/cycle-index'
import type { TriggerChar } from '#lib/task-input-parser'

interface CursorTrigger {
  trigger: TriggerChar
  partial: string
  tokenStart: number
}

/**
 * State and behavior for `CreateTaskInline`'s `^` parent-picker trigger:
 * searching candidates, applying a selection into the input, and keeping
 * `selectedParent` in sync with the visible `^<number>` token.
 */
export function useParentPicker({
  parentId,
  input,
  setInput,
  cursorTrigger,
  setCursorTrigger,
  parsedParentNumber,
  inputRef,
}: {
  parentId: string | undefined
  input: string
  setInput: (value: string) => void
  cursorTrigger: CursorTrigger | null
  setCursorTrigger: (value: null) => void
  parsedParentNumber: number | undefined
  inputRef: RefObject<HTMLInputElement | null>
}) {
  const [parentMenuIndex, setParentMenuIndex] = useState(0)
  const [selectedParent, setSelectedParent] = useState<SearchResult | null>(
    null,
  )

  // Inert when `parentId` is already fixed by the surrounding context (e.g.
  // a subtask's own add-row) — the trigger still fires structurally so it
  // keeps suppressing the other dropdowns while `^...` is typed, but no
  // parent-search menu opens and no parent is attached from it.
  const parentTriggerActive = cursorTrigger?.trigger === '^' && parentId == null

  const parentSearchQuery = parentTriggerActive ? cursorTrigger.partial : ''
  const { data: parentSearchResultsRaw, isFetching: isParentSearchFetching } =
    useSearchTasks(parentSearchQuery)
  const parentCandidates = parentSearchResultsRaw ?? []

  const showParentMenu = parentTriggerActive

  const applyParentSelection = useCallback(
    (candidate: SearchResult) => {
      if (!cursorTrigger) return

      const before = input.slice(0, cursorTrigger.tokenStart)
      const tokenEnd = input.indexOf(' ', cursorTrigger.tokenStart)
      const after = input.slice(tokenEnd === -1 ? input.length : tokenEnd)

      const value = String(candidate.number)
      const newInput = `${before}^${value}${after ? '' : ' '}${after}`
      setInput(newInput)
      setSelectedParent(candidate)
      setCursorTrigger(null)

      requestAnimationFrame(() => {
        const el = inputRef.current
        if (el) {
          el.focus()
          const pos = before.length + 1 + value.length + (after ? 0 : 1)
          el.setSelectionRange(pos, pos)
        }
      })
    },
    [input, cursorTrigger, setInput, setCursorTrigger, inputRef],
  )

  // Keeps `selectedParent` in sync with the visible `^<number>` token —
  // cleared if the user edits or deletes it — so it can be trusted directly
  // everywhere else without re-checking the parsed input.
  useEffect(() => {
    if (
      selectedParent != null &&
      parsedParentNumber !== selectedParent.number
    ) {
      setSelectedParent(null)
    }
  }, [parsedParentNumber, selectedParent])

  const resolvedParentId = parentId ?? selectedParent?.id

  const resetParentMenu = useCallback(() => {
    setParentMenuIndex(0)
  }, [])

  const handleParentMenuKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          if (parentCandidates.length > 0) {
            setParentMenuIndex((prev) =>
              cycleIndex(prev, 1, parentCandidates.length),
            )
          }
          break
        case 'ArrowUp':
          e.preventDefault()
          if (parentCandidates.length > 0) {
            setParentMenuIndex((prev) =>
              cycleIndex(prev, -1, parentCandidates.length),
            )
          }
          break
        case 'Enter':
        case 'Tab': {
          // Always preventDefault while the menu is open, even with zero
          // candidates (no match yet, or the search is still debouncing) —
          // otherwise Enter falls through to the form's native submit and
          // silently creates the task without the parent the user just
          // asked to attach.
          e.preventDefault()
          const candidate = parentCandidates[parentMenuIndex]
          if (candidate != null) {
            applyParentSelection(candidate)
          }
          break
        }
      }
    },
    [parentCandidates, parentMenuIndex, applyParentSelection],
  )

  return {
    selectedParent,
    setSelectedParent,
    showParentMenu,
    parentCandidates,
    isParentSearchFetching,
    parentMenuIndex,
    resetParentMenu,
    applyParentSelection,
    handleParentMenuKeyDown,
    resolvedParentId,
  }
}
