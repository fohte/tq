import { ProjectUrlCard } from '#components/task/project-url-card'
import { ProjectUrlChip } from '#components/task/project-url-chip'
import type { InlineReferenceProvider } from '#lib/inline-reference/types'

export interface ProjectUrlData {
  url: string
}

// Matches a project URL's path shape only (`/projects/<id>`), on any host:
// the API's POST /api/projects/resolve-url is the authoritative check for
// whether the host is actually this tq instance (see api/src/routes/projects.ts),
// so this only needs to be permissive enough to trigger a resolve attempt.
const PROJECT_URL_PATTERN =
  /https?:\/\/[^/\s]+\/projects\/[0-9a-zA-Z-]+\/?(?![\w/-])/g

export const projectUrlProvider: InlineReferenceProvider<ProjectUrlData> = {
  id: 'project-url',

  findMatches(text) {
    const matches = []
    for (const match of text.matchAll(PROJECT_URL_PATTERN)) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        raw: match[0],
        data: { url: match[0] },
      })
    }
    return matches
  },

  Chip: ProjectUrlChip,
  Card: ProjectUrlCard,
}
