import type { KeyboardEvent } from 'react'
import { useCallback, useMemo, useState } from 'react'

import type { SearchResult } from '#hooks/use-search'
import { useSearchTasks } from '#hooks/use-search'
import { useTaskList, useUpdateTaskParent } from '#hooks/use-tasks'
import { cycleIndex } from '#lib/cycle-index'
import { getDescendantIds } from '#lib/task-tree'

/**
 * State and behavior for `CreateTaskInline`'s "link an existing task as a
 * subtask" dropdown — only active when this row creates a subtask
 * (`parentId` set).
 */
export function useExistingTaskLink({
  parentId,
  parentTaskNumber,
  triggerDropdownActive,
  title,
  closeOnSubmit,
  onClose,
  onInputReset,
}: {
  parentId: string | undefined
  parentTaskNumber: number | undefined
  /** Whether the mutually-exclusive @/>/#/%/^ trigger dropdown is active. */
  triggerDropdownActive: boolean
  title: string
  closeOnSubmit: boolean
  onClose: () => void
  onInputReset: () => void
}) {
  const [existingMenuIndex, setExistingMenuIndex] = useState(0)
  const [existingMenuDismissed, setExistingMenuDismissed] = useState(false)
  const [linkDialogCandidate, setLinkDialogCandidate] =
    useState<SearchResult | null>(null)

  const updateTaskParent = useUpdateTaskParent()

  // Only searched while no trigger dropdown is active, since the two
  // dropdowns are mutually exclusive.
  const existingSearchQuery =
    parentId != null && !triggerDropdownActive ? title : ''
  const { data: searchResults } = useSearchTasks(existingSearchQuery)

  const { categorized: allTasksForLinking } = useTaskList(undefined, {
    enabled: parentId != null,
  })

  const excludedTaskIds = useMemo(() => {
    if (parentId == null) return new Set<string>()
    return new Set([
      parentId,
      ...getDescendantIds(allTasksForLinking.all, parentId),
    ])
  }, [parentId, allTasksForLinking.all])

  const existingCandidates = useMemo(
    () => (searchResults ?? []).filter((t) => !excludedTaskIds.has(t.id)),
    [searchResults, excludedTaskIds],
  )

  const showExistingMenu =
    parentId != null &&
    parentTaskNumber != null &&
    !triggerDropdownActive &&
    title !== '' &&
    existingCandidates.length > 0 &&
    !existingMenuDismissed

  const resetExistingMenu = useCallback(() => {
    setExistingMenuIndex(0)
    setExistingMenuDismissed(false)
  }, [])

  const dismissExistingMenu = useCallback(() => {
    setExistingMenuIndex(0)
    setExistingMenuDismissed(true)
  }, [])

  const finishLink = useCallback(() => {
    onInputReset()
    setExistingMenuIndex(0)
    if (closeOnSubmit) onClose()
  }, [closeOnSubmit, onClose, onInputReset])

  const selectCandidate = useCallback(
    (candidate: SearchResult) => {
      if (parentId == null) return
      if (candidate.parentId == null) {
        updateTaskParent.mutate(
          { id: candidate.id, parentId },
          { onSuccess: finishLink },
        )
      } else {
        setLinkDialogCandidate(candidate)
      }
    },
    [parentId, updateTaskParent, finishLink],
  )

  const handleExistingMenuKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      const total = existingCandidates.length + 1
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setExistingMenuIndex((prev) => cycleIndex(prev, 1, total))
          break
        case 'ArrowUp':
          e.preventDefault()
          setExistingMenuIndex((prev) => cycleIndex(prev, -1, total))
          break
        case 'Enter':
        case 'Tab':
          if (existingMenuIndex > 0) {
            e.preventDefault()
            const candidate = existingCandidates[existingMenuIndex - 1]
            if (candidate != null) selectCandidate(candidate)
          }
          break
      }
    },
    [existingCandidates, existingMenuIndex, selectCandidate],
  )

  const confirmLinkDialog = useCallback(() => {
    if (linkDialogCandidate == null || parentId == null) return
    updateTaskParent.mutate(
      { id: linkDialogCandidate.id, parentId },
      {
        onSuccess: () => {
          setLinkDialogCandidate(null)
          finishLink()
        },
      },
    )
  }, [linkDialogCandidate, parentId, updateTaskParent, finishLink])

  return {
    existingCandidates,
    showExistingMenu,
    existingMenuIndex,
    resetExistingMenu,
    dismissExistingMenu,
    selectCandidate,
    handleExistingMenuKeyDown,
    linkDialogCandidate,
    setLinkDialogCandidate,
    confirmLinkDialog,
  }
}
