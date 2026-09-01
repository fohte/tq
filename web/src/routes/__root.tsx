import {
  createRootRoute,
  Outlet,
  retainSearchParams,
} from '@tanstack/react-router'

import { AppLayout } from '#components/layout/app-layout'
import { useGithubSync } from '#hooks/use-github-link'
import type { ContextFilterMode } from '#lib/context-filter'

interface RootSearch {
  context?: ContextFilterMode
}

// Omits `context` entirely (rather than defaulting it to 'all') when the URL
// doesn't have it. retainSearchParams below only fills in a key that's
// absent from the destination search, so an explicit value (including
// 'all', set by resetting the filter) always wins over a stale retained one.
export function validateSearch(search: Record<string, unknown>): RootSearch {
  return search['context'] === 'work' || search['context'] === 'personal'
    ? { context: search['context'] }
    : {}
}

export const Route = createRootRoute({
  validateSearch,
  search: {
    middlewares: [retainSearchParams(['context'])],
  },
  component: RootComponent,
})

function RootComponent() {
  useGithubSync()

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  )
}
