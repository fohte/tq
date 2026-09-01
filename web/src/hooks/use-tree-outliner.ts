import { useCallback, useEffect, useMemo, useState } from 'react'

import { isEditableTarget } from '#hooks/use-global-keybindings'
import type { TreeNode } from '#hooks/use-tasks'
import { flattenVisibleRows } from '#lib/tree-outliner'

function buildNodesById(tree: TreeNode[]): Map<string, TreeNode> {
  const map = new Map<string, TreeNode>()

  function visit(nodes: TreeNode[]) {
    for (const node of nodes) {
      map.set(node.id, node)
      visit(node.children)
    }
  }

  visit(tree)
  return map
}

/**
 * Tracks which node ids have had their expand-state explicitly flipped away
 * from `defaultExpanded`. `isExpanded(id) = defaultExpanded !== toggledIds.has(id)`
 * — with `defaultExpanded: true` this is a "collapsed ids" set (today's
 * eager-fetch behavior); with `defaultExpanded: false` it's an "expanded
 * ids" set, needed by lazy/browse mode where nothing has children fetched
 * yet so nothing should start expanded.
 */
export function useExpandedIds(defaultExpanded: boolean) {
  const [toggledIds, setToggledIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  )

  const isExpanded = useCallback(
    (id: string) => defaultExpanded !== toggledIds.has(id),
    [toggledIds, defaultExpanded],
  )

  const toggleExpand = useCallback((id: string) => {
    setToggledIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  return { isExpanded, toggleExpand, toggledIds }
}

export function useTreeOutliner(
  tree: TreeNode[],
  options: {
    enabled: boolean
    onOpenSiblingCreate?: (parent: TreeNode | null) => void
    isExpanded?: (id: string) => boolean
    toggleExpand?: (id: string) => void
  },
) {
  const { enabled, onOpenSiblingCreate } = options
  const ownExpandState = useExpandedIds(true)
  const isExpanded = options.isExpanded ?? ownExpandState.isExpanded
  const toggleExpand = options.toggleExpand ?? ownExpandState.toggleExpand

  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)

  const visibleRows = useMemo(
    () => flattenVisibleRows(tree, isExpanded),
    [tree, isExpanded],
  )
  const nodesById = useMemo(() => buildNodesById(tree), [tree])

  const selectRow = useCallback((id: string) => {
    setSelectedRowId(id)
  }, [])

  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        e.repeat ||
        isEditableTarget(e.target)
      ) {
        return
      }

      if (e.key === 'o') {
        if (selectedRowId == null || onOpenSiblingCreate == null) return
        e.preventDefault()
        const row = visibleRows.find((r) => r.id === selectedRowId)
        if (row == null) return
        const parent =
          row.parentId != null ? (nodesById.get(row.parentId) ?? null) : null
        onOpenSiblingCreate(parent)
        return
      }

      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      if (visibleRows.length === 0) return
      e.preventDefault()

      const currentIndex = visibleRows.findIndex(
        (row) => row.id === selectedRowId,
      )

      if (currentIndex === -1) {
        const fallback =
          e.key === 'ArrowDown'
            ? visibleRows[0]
            : visibleRows[visibleRows.length - 1]
        if (fallback != null) setSelectedRowId(fallback.id)
        return
      }

      const nextIndex =
        e.key === 'ArrowDown'
          ? Math.min(visibleRows.length - 1, currentIndex + 1)
          : Math.max(0, currentIndex - 1)
      const next = visibleRows[nextIndex]
      if (next != null) setSelectedRowId(next.id)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [enabled, selectedRowId, visibleRows, nodesById, onOpenSiblingCreate])

  return {
    isExpanded,
    toggleExpand,
    selectedRowId,
    selectRow,
  }
}
