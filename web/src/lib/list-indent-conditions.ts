import type { NodeType } from '@milkdown/kit/prose/model'
import type { EditorState } from '@milkdown/kit/prose/state'

export function isAtListItemStart(
  state: EditorState,
  listItemType: NodeType,
): boolean {
  const { selection } = state
  if (!selection.empty) return false
  const { $from } = selection
  return (
    $from.parentOffset === 0 &&
    $from.depth >= 1 &&
    $from.node(-1).type === listItemType
  )
}

// In ProseMirror list structures, a nested item's enclosing list sits inside
// an ancestor list item at depth -3.
export function isNestedListItem(
  state: EditorState,
  listItemType: NodeType,
): boolean {
  const { $from } = state.selection
  return $from.depth >= 3 && $from.node(-3).type === listItemType
}
