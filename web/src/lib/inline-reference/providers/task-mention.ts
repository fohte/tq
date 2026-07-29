import { MENTION_PATTERN } from 'api/constants/mention-pattern'

import { TaskMentionChip } from '#components/task/task-mention-chip'
import {
  ensureTaskMentionPreviewLoaded,
  getCachedTaskMentionPreview,
  isTaskMentionPreviewKey,
} from '#hooks/use-task-mentions'
import type { InlineReferenceProvider } from '#lib/inline-reference/types'
import { queryClient } from '#lib/query-client'

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

  isReady(data) {
    return getCachedTaskMentionPreview(queryClient, data.number) != null
  },

  ensureLoaded(data) {
    ensureTaskMentionPreviewLoaded(queryClient, data.number)
  },

  subscribe(notify) {
    return queryClient.getQueryCache().subscribe((event) => {
      // `event.query` is typed `Query<any, any, any, any>` by
      // @tanstack/query-core, so `queryKey` comes through as `any`; widen to
      // `unknown` and narrow with a real runtime check instead of asserting.
      const queryKey: unknown = event.query.queryKey
      if (Array.isArray(queryKey) && isTaskMentionPreviewKey(queryKey)) {
        notify()
      }
    })
  },

  Chip: TaskMentionChip,
}
