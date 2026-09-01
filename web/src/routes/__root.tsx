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

// Omits `context` only when it's genuinely unset, so retainSearchParams
// below can still carry a non-default value across navigations that don't
// pass `search` explicitly.
function validateSearch(search: Record<string, unknown>): RootSearch {
  if (search['context'] === 'work' || search['context'] === 'personal') {
    return { context: search['context'] }
  }
  return 'context' in search ? { context: 'all' } : {}
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
