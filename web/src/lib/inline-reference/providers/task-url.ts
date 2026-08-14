import { TaskUrlCard } from '#components/task/task-url-card'
import { TaskUrlChip } from '#components/task/task-url-chip'
import type { InlineReferenceProvider } from '#lib/inline-reference/types'

export interface TaskUrlData {
  url: string
}

// Matches a task URL's path shape only (`/tasks/<number-or-uuid>`), on any
// host: the API's POST /api/tasks/resolve-url is the authoritative check for
// whether the host is actually this tq instance (see resolve-url.ts), so
// this only needs to be permissive enough to trigger a resolve attempt. A
// trailing path segment (`/pages/abc`), rather than being split off like a
// query string or fragment, makes the whole thing not match at all: the URL
// might point at something more specific than the task itself.
const TASK_URL_PATTERN =
  /https?:\/\/[^/\s]+\/tasks\/[0-9a-zA-Z-]+\/?(?![\w/-])/g

export const taskUrlProvider: InlineReferenceProvider<TaskUrlData> = {
  id: 'task-url',

  findMatches(text) {
    const matches = []
    for (const match of text.matchAll(TASK_URL_PATTERN)) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        raw: match[0],
        data: { url: match[0] },
      })
    }
    return matches
  },

  Chip: TaskUrlChip,
  Card: TaskUrlCard,
}
