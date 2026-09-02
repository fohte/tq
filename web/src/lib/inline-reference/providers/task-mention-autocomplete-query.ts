import type { EditorState } from '@milkdown/kit/prose/state'

export interface ActiveMentionQuery {
  from: number
  to: number
  query: string
}

// `#` not preceded by \w, `#`, or `/` (skips URL fragments like
// `.../#anchor`), followed by non-whitespace, non-`#` text up to the
// cursor. The query may contain letters (title search) since the inserted
// mention is always plain `#<number>`.
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
