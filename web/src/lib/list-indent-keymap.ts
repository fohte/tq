import { commandsCtx } from '@milkdown/kit/core'
import type { Ctx } from '@milkdown/kit/ctx'
import {
  liftListItemCommand,
  listItemSchema,
  sinkListItemCommand,
} from '@milkdown/kit/preset/commonmark'
import type { NodeType } from '@milkdown/kit/prose/model'
import type { Command, EditorState } from '@milkdown/kit/prose/state'
import { $useKeymap } from '@milkdown/kit/utils'

// True when the cursor sits collapsed at the very start of a list item's
// content, e.g. `state.selection.$from.node(-1)` is that item's node — the
// only position "行頭で Space/Backspace" makes sense from.
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

// True when the list item is nested inside another list item, i.e. its own
// list (bullet/ordered) sits 2 levels above the item inside a parent list
// item's content. `liftListItem` (used by both LiftListItem/Shift-Tab and
// the outdent-on-Backspace binding below) only outdents in this case; on a
// top-level item it instead unwraps the item out of its list entirely,
// which Backspace must not trigger (it keeps joining with the previous
// item, see liftFirstListItemCommand in @milkdown/preset-commonmark).
export function isNestedListItem(
  state: EditorState,
  listItemType: NodeType,
): boolean {
  const { $from } = state.selection
  return $from.depth >= 3 && $from.node(-3).type === listItemType
}

function indentListItem(ctx: Ctx): Command {
  return (state) => {
    if (!isAtListItemStart(state, listItemSchema.type(ctx))) return false
    return ctx.get(commandsCtx).call(sinkListItemCommand.key)
  }
}

function outdentNestedListItem(ctx: Ctx): Command {
  return (state) => {
    const listItemType = listItemSchema.type(ctx)
    if (
      !isAtListItemStart(state, listItemType) ||
      !isNestedListItem(state, listItemType)
    )
      return false
    return ctx.get(commandsCtx).call(liftListItemCommand.key)
  }
}

// iOS's software keyboard has no Tab key, so Tab/Mod-]'s sink and
// Shift-Tab/Mod-['s lift (see listItemKeymap in @milkdown/preset-commonmark)
// are unreachable there. This adds a Space/Backspace-based alternative that
// only fires at a list item's start, leaving Space's normal character entry
// (and the Markdown input rules that key off it, e.g. "- ") untouched
// everywhere else.
export const listIndentKeymap = $useKeymap('listIndent', {
  IndentListItem: {
    shortcuts: 'Space',
    command: indentListItem,
  },
  OutdentNestedListItem: {
    shortcuts: 'Backspace',
    // Above the default 50 so this is tried before listItemKeymap's
    // Backspace -> liftFirstListItem (joins with the previous item): a
    // nested item should outdent instead, falling through to the default
    // join when the item isn't nested.
    priority: 60,
    command: outdentNestedListItem,
  },
})
