import { useCallback, useEffect, useMemo, useState } from 'react'

import type { InheritedTaskAttributes } from '#components/task/create-task-inline'
import { isEditableTarget } from '#hooks/use-global-keybindings'
import type { TreeNode } from '#hooks/use-tasks'
import {
  type AncestorRef,
  buildAncestorChain,
  flattenVisibleRows,
  type OutlinerInput,
  resolveOutlinerTarget,
} from '#lib/tree-outliner'

export type { OutlinerInput }

export interface ResolvedOutlinerInput {
  anchorRowId: string
  mode: OutlinerInput['mode']
  parentId: string | null
  parentNumber: number | null
  depth: number
  inherited: InheritedTaskAttributes | undefined
}

interface OutlinerState {
  input: OutlinerInput
  /**
   * Ancestor chain of the parent the input resolved to when it was opened,
   * root-first. Tab/Shift-Tab move `pointer` within this fixed chain instead
   * of dynamically extending it, so depth changes are bounded by the
   * anchor's own ancestry rather than newly-created sibling rows.
   */
  chain: AncestorRef[]
  pointer: number
}

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

  return { isExpanded, toggleExpand, expandedIds: toggledIds }
}

export function useTreeOutliner(
  tree: TreeNode[],
  options: {
    enabled: boolean
    isExpanded?: (id: string) => boolean
    toggleExpand?: (id: string) => void
  },
) {
  const { enabled } = options
  const ownExpandState = useExpandedIds(true)
  const isExpanded = options.isExpanded ?? ownExpandState.isExpanded
  const toggleExpand = options.toggleExpand ?? ownExpandState.toggleExpand

  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)
  const [outlinerState, setOutlinerState] = useState<OutlinerState | null>(null)

  const visibleRows = useMemo(
    () => flattenVisibleRows(tree, isExpanded),
    [tree, isExpanded],
  )
  const nodesById = useMemo(() => buildNodesById(tree), [tree])

  const selectRow = useCallback((id: string) => {
    setSelectedRowId(id)
  }, [])

  const openOutlinerInput = useCallback(
    (anchorRowId: string, mode: OutlinerInput['mode']) => {
      const resolved = resolveOutlinerTarget(visibleRows, {
        anchorRowId,
        mode,
      })
      if (resolved == null) return

      setOutlinerState({
        input: { anchorRowId, mode },
        chain: buildAncestorChain(visibleRows, resolved.parentId),
        pointer: resolved.depth,
      })
      setSelectedRowId(anchorRowId)
    },
    [visibleRows],
  )

  const openChildInput = useCallback(
    (rowId: string) => {
      openOutlinerInput(rowId, 'child')
    },
    [openOutlinerInput],
  )

  const closeOutlinerInput = useCallback(() => {
    setOutlinerState(null)
  }, [])

  const indentOutlinerInput = useCallback(() => {
    setOutlinerState((prev) =>
      prev == null
        ? null
        : { ...prev, pointer: Math.min(prev.chain.length, prev.pointer + 1) },
    )
  }, [])

  const outdentOutlinerInput = useCallback(() => {
    setOutlinerState((prev) =>
      prev == null ? null : { ...prev, pointer: Math.max(0, prev.pointer - 1) },
    )
  }, [])

  const outlinerInput = outlinerState?.input ?? null

  const outlinerTarget = useMemo((): ResolvedOutlinerInput | null => {
    if (outlinerState == null) return null

    const { chain, pointer, input } = outlinerState
    const parent = pointer === 0 ? null : chain[pointer - 1]
    const parentId = parent?.id ?? null
    const parentNode = parentId != null ? nodesById.get(parentId) : undefined
    const inherited: InheritedTaskAttributes | undefined =
      parentNode == null
        ? undefined
        : {
            context: parentNode.context,
            projectId: parentNode.projectId,
            labels: parentNode.labels,
          }

    return {
      anchorRowId: input.anchorRowId,
      mode: input.mode,
      parentId,
      parentNumber: parent?.number ?? null,
      depth: pointer,
      inherited,
    }
  }, [outlinerState, nodesById])

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
        openOutlinerInput(selectedRowId, 'sibling')
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
  }, [enabled, selectedRowId, visibleRows, openOutlinerInput])

  return {
    isExpanded,
    toggleExpand,
    selectedRowId,
    selectRow,
    outlinerInput,
    outlinerTarget,
    openChildInput,
    closeOutlinerInput,
    indentOutlinerInput,
    outdentOutlinerInput,
  }
}
