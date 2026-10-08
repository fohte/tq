import { matchAppResourceUrls } from 'api/lib/app-url'

import { TaskUrlCard } from '#components/task/task-url-card'
import { TaskUrlChip } from '#components/task/task-url-chip'
import type { InlineReferenceProvider } from '#lib/inline-reference/types'

export interface TaskUrlData {
  id: string
}

export const taskUrlProvider: InlineReferenceProvider<TaskUrlData> = {
  id: 'task-url',

  // Task URL and mention chips resolve through the shared preview query,
  // keyed by the extracted number-or-UUID string.
  findMatches(text) {
    return matchAppResourceUrls(text, location.host, 'tasks').map((match) => ({
      start: match.start,
      end: match.end,
      raw: match.raw,
      data: { id: match.id },
    }))
  },

  Chip: TaskUrlChip,
  Card: TaskUrlCard,
}
