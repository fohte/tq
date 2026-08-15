import { matchAppResourceUrls } from 'api/lib/app-url'

import { ProjectUrlCard } from '#components/task/project-url-card'
import { ProjectUrlChip } from '#components/task/project-url-chip'
import type { InlineReferenceProvider } from '#lib/inline-reference/types'

export interface ProjectUrlData {
  id: string
}

export const projectUrlProvider: InlineReferenceProvider<ProjectUrlData> = {
  id: 'project-url',

  // Matches a project URL's path shape (`/projects/<id>`) on this page's
  // own host, then hands the extracted id straight to
  // `GET /api/projects/:id` — the same endpoint the project detail page
  // resolves through (see `useProject`).
  findMatches(text) {
    return matchAppResourceUrls(text, window.location.host, 'projects').map(
      (match) => ({
        start: match.start,
        end: match.end,
        raw: match.raw,
        data: { id: match.id },
      }),
    )
  },

  Chip: ProjectUrlChip,
  Card: ProjectUrlCard,
}
