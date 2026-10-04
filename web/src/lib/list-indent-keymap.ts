import { commandsCtx } from '@milkdown/kit/core'
import type { Ctx } from '@milkdown/kit/ctx'
import {
  liftListItemCommand,
  listItemSchema,
  sinkListItemCommand,
} from '@milkdown/kit/preset/commonmark'
import type { Command } from '@milkdown/kit/prose/state'
import { $useKeymap } from '@milkdown/kit/utils'

import {
  isAtListItemStart,
  isNestedListItem,
} from '#lib/list-indent-conditions'

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

// Binds Space to indent and Backspace to outdent at list item starts
// for environments without a Tab key.
export const listIndentKeymap = $useKeymap('listIndent', {
  IndentListItem: {
    shortcuts: 'Space',
    command: indentListItem,
  },
  OutdentNestedListItem: {
    shortcuts: 'Backspace',
    // Runs before Milkdown's default Backspace keymap (priority 50).
    priority: 60,
    command: outdentNestedListItem,
  },
})
