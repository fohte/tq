import type { EditorState } from '@milkdown/kit/prose/state'

export interface ActiveMentionQuery {
  from: number
  to: number
  query: string
}

// A `#` not preceded by a word character, another `#`, or `/` (the last one
// on top of api/src/services/task-links.ts's MENTION_PATTERN, to keep a URL
// fragment like `https://example.com/path/#anchor` from being read as a
// mention), followed by a run of non-whitespace, non-`#` characters up to
// the cursor. Unlike the link pattern, the query may contain letters too
// (title search), since the inserted mention always becomes plain
// `#<number>` regardless of what was typed to find it.
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
