import type { EditorState } from '@milkdown/kit/prose/state'

export interface ActiveMentionQuery {
  from: number
  to: number
  query: string
}

// Skips URL fragments (`.../#...`) and allows non-digit queries for title search.
const TRIGGER_PATTERN = /(?<![\w#/])#([^\s#]*)$/

// Finds an in-progress `#<query>` mention right before a collapsed cursor,
// within the current textblock only (a mention can't span block boundaries).
export function findActiveMentionQuery(
  state: EditorState,
): ActiveMentionQuery | undefined {
  const { selection } = state
  if (!selection.empty) return undefined

  const $from = selection.$from
  if (!$from.parent.isTextblock) return undefined

  const textBeforeCursor = $from.parent.textBetween(
    0,
    $from.parentOffset,
    undefined,
    '￼',
  )
  const match = TRIGGER_PATTERN.exec(textBeforeCursor)
  if (!match) return undefined

  return {
    from: $from.start() + match.index,
    to: $from.pos,
    query: match[1] ?? '',
  }
}
