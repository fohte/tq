import {
  createRootRoute,
  Outlet,
  stripSearchParams,
} from '@tanstack/react-router'

import { AppLayout } from '#components/layout/app-layout'
import { useGithubSync } from '#hooks/use-github-link'
import type { ContextFilterMode } from '#lib/context-filter'

export interface RootSearch {
  context?: ContextFilterMode
  tag?: string
}

const rootSearchDefaults = { context: 'all' as const }

function validateSearch(search: Record<string, unknown>): RootSearch {
  const context: ContextFilterMode =
    search['context'] === 'work' || search['context'] === 'personal'
      ? search['context']
      : 'all'
  const tag = typeof search['tag'] === 'string' ? search['tag'] : undefined
  return { context, ...(tag != null ? { tag } : {}) }
}

export const Route = createRootRoute({
  validateSearch,
  search: {
    middlewares: [stripSearchParams(rootSearchDefaults)],
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
