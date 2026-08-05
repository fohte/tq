import type { TreeNode } from '#hooks/use-tasks'

export interface VisibleRow {
  id: string
  number: number
  parentId: string | null
  depth: number
}

/**
 * Flatten a task tree into the order rows are actually rendered on screen,
 * skipping the subtree of any node whose id is in `collapsedIds`. Used to
 * drive Up/Down row selection, which must only step through rows the user
 * can currently see.
 */
export function flattenVisibleRows(
  tree: TreeNode[],
  collapsedIds: ReadonlySet<string>,
): VisibleRow[] {
  const rows: VisibleRow[] = []

  function visit(nodes: TreeNode[], depth: number) {
    for (const node of nodes) {
      rows.push({
        id: node.id,
        number: node.number,
        parentId: node.parentId,
        depth,
      })
      if (!collapsedIds.has(node.id)) {
        visit(node.children, depth + 1)
      }
    }
  }

  visit(tree, 0)
  return rows
}

export interface OutlinerInput {
  anchorRowId: string
  /** Which relation the anchor has to the target parent, as of opening. */
  mode: 'child' | 'sibling'
}

export interface ResolvedOutlinerTarget {
  parentId: string | null
  parentNumber: number | null
  depth: number
}

/**
 * Resolve an `OutlinerInput` to the parent/depth the new input row should be
 * created under, given the currently visible rows.
 */
export function resolveOutlinerTarget(
  rows: readonly VisibleRow[],
  input: OutlinerInput,
): ResolvedOutlinerTarget | null {
  const anchor = rows.find((row) => row.id === input.anchorRowId)
  if (anchor == null) return null

  if (input.mode === 'child') {
    return {
      parentId: anchor.id,
      parentNumber: anchor.number,
      depth: anchor.depth + 1,
    }
  }

  if (anchor.parentId == null) {
    return { parentId: null, parentNumber: null, depth: anchor.depth }
  }

  const parent = rows.find((row) => row.id === anchor.parentId)
  return {
    parentId: anchor.parentId,
    parentNumber: parent?.number ?? null,
    depth: anchor.depth,
  }
}

export interface AncestorRef {
  id: string
  number: number
}

/**
 * Walk `parentId` up to the root, root-first, `parentId` itself included as
 * the final entry (so the chain's length equals its depth). The result
 * seeds the bounded Tab/Shift-Tab depth stack: an outliner input can only
 * move between the top level and this chain's depth, never deeper than
 * where it was originally opened.
 */
export function buildAncestorChain(
  rows: readonly VisibleRow[],
  parentId: string | null,
): AncestorRef[] {
  const byId = new Map(rows.map((row) => [row.id, row]))
  const chain: AncestorRef[] = []

  let currentId = parentId
  while (currentId != null) {
    const row = byId.get(currentId)
    if (row == null) break
    chain.unshift({ id: row.id, number: row.number })
    currentId = row.parentId
  }

  return chain
}
