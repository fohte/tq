import { matchAppResourceUrls } from 'api/lib/app-url'

import { TaskUrlCard } from '#components/task/task-url-card'
import { TaskUrlChip } from '#components/task/task-url-chip'
import type { InlineReferenceProvider } from '#lib/inline-reference/types'

export interface TaskUrlData {
  id: string
}

export const taskUrlProvider: InlineReferenceProvider<TaskUrlData> = {
  id: 'task-url',

  // Matches a task URL's path shape (`/tasks/<number-or-uuid>`) on this
  // page's own host, then hands the extracted id straight to
  // `GET /api/tasks/:id` — the same endpoint `#123` mentions resolve
  // through (see `findTaskByIdOrNumber`), which already accepts either
  // form.
  findMatches(text) {
    return matchAppResourceUrls(text, window.location.host, 'tasks').map(
      (match) => ({
        start: match.start,
        end: match.end,
        raw: match.raw,
        data: { id: match.id },
      }),
    )
  },

  Chip: TaskUrlChip,
  Card: TaskUrlCard,
}
