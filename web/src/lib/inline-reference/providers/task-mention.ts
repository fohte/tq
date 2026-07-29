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

// Must match api/src/services/task-links.ts's MENTION_PATTERN exactly: a
// non-word, non-`#` character (or string start) before the `#`, and no
// trailing word character, so `#123` matches but `foo#123`, `##123`, and
// `#123abc` don't. A chip that appears here but isn't linked server-side (or
// vice versa) would be a confusing inconsistency.
const MENTION_PATTERN = /(?<![\w#])#(\d+)(?!\w)/g

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
