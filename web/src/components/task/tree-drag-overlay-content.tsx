import { StatusIcon } from '#components/task/status-icon'
import { rowIndentPx, TaskNumberLabel } from '#components/task/task-row-shared'
import type { TreeNode } from '#hooks/use-tasks'

export interface DropTarget {
  node: TreeNode
  depth: number
  mode: 'child' | 'sibling'
}

export function TreeDragOverlayContent({
  node,
  target,
}: {
  node: TreeNode
  target: DropTarget | null
}) {
  // Mirrors TreeTaskGridRow's own indent formula (see
  // tree-task-grid-row.tsx), computed from the target row's depth rather
  // than the dragged row's — the indent shift is how this preview
  // communicates child vs. sibling placement.
  const targetDepth =
    target == null
      ? 0
      : target.mode === 'child'
        ? target.depth + 1
        : target.depth

  return (
    <div className="border border-dashed border-border-strong bg-card">
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ paddingLeft: `${String(rowIndentPx(targetDepth))}px` }}
      >
        <StatusIcon status={node.status} />
        <TaskNumberLabel number={node.number} />
        <span className="truncate text-sm">{node.title}</span>
      </div>
      {target != null && (
        <div className="border-t border-border px-3 py-1 font-mono text-2xs text-muted-foreground">
          {target.mode === 'child'
            ? `→ becomes child of #${String(target.node.number)}`
            : `→ becomes sibling of #${String(target.node.number)}`}
        </div>
      )}
    </div>
  )
}
