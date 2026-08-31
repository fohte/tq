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

export function useTreeOutliner(
  tree: TreeNode[],
  options: {
    enabled: boolean
    onOpenSiblingCreate: (parent: TreeNode | null) => void
  },
) {
  const { enabled, onOpenSiblingCreate } = options

  const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  )
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)

  const visibleRows = useMemo(
    () => flattenVisibleRows(tree, collapsedIds),
    [tree, collapsedIds],
  )
  const nodesById = useMemo(() => buildNodesById(tree), [tree])

  const isExpanded = useCallback(
    (id: string) => !collapsedIds.has(id),
    [collapsedIds],
  )

  const toggleExpand = useCallback((id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

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
        if (selectedRowId == null) return
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
