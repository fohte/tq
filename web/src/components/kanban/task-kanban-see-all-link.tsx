import { Link } from '@tanstack/react-router'
import { buildSearchQuery } from 'api/search-query-parser'

import type { TaskCommitment } from '#hooks/use-tasks'

export function TaskKanbanSeeAllLink({
  commitment,
}: {
  commitment: TaskCommitment
}) {
  return (
    <Link
      to="/tasks"
      search={{
        q: buildSearchQuery({
          freeText: '',
          status: ['todo'],
          commitment,
          sortBy: 'updated',
        }),
      }}
      className="font-mono text-2xs text-muted-foreground hover:text-foreground"
    >
      see all →
    </Link>
  )
}
