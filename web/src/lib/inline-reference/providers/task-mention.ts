import { MENTION_PATTERN } from 'api/constants/mention-pattern'

import { TaskMentionCard } from '#components/task/task-mention-card'
import { TaskMentionChip } from '#components/task/task-mention-chip'
import type { InlineReferenceProvider } from '#lib/inline-reference/types'

export interface TaskMentionData {
  number: number
}

export const taskMentionProvider: InlineReferenceProvider<TaskMentionData> = {
  id: 'task-mention',

  findMatches(text) {
    const matches = []
    for (const match of text.matchAll(MENTION_PATTERN)) {
      const digits = match[1]
      if (digits == null) continue
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        raw: match[0],
        data: { number: Number(digits) },
      })
    }
    return matches
  },

  Chip: TaskMentionChip,
  Card: TaskMentionCard,
}
