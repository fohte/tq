import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  retainSearchParams,
} from '@tanstack/react-router'
import { describe, expect, it } from 'vitest'

import { validateSearch } from '#routes/__root'

async function buildRouter(initialEntry: string) {
  const rootRoute = createRootRoute({
    validateSearch,
    search: {
      middlewares: [retainSearchParams(['context'])],
    },
  })
  const routeA = createRoute({ getParentRoute: () => rootRoute, path: '/a' })
  const routeB = createRoute({ getParentRoute: () => rootRoute, path: '/b' })
  const router = createRouter({
    routeTree: rootRoute.addChildren([routeA, routeB]),
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  })
  await router.load()
  return router
}

// navigate()'s `to`/`search` param types resolve against the app's real
// registered route tree (see routeTree.gen.ts), not this test's local one,
// so they don't match here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see above
async function navigateTo(router: any, opts: unknown): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- see above
  await router.navigate(opts)
}

describe('root route search', () => {
  it('retains context across a navigation that omits search (e.g. a bare Link)', async () => {
    const router = await buildRouter('/a?context=work')
    await navigateTo(router, { to: '/b' })
    expect(router.state.location.search).toEqual({ context: 'work' })
  })

  it('keeps context reset to the default across a later navigation', async () => {
    const router = await buildRouter('/a?context=work')
    await navigateTo(router, {
      to: '/a',
      search: (prev: Record<string, unknown>) => ({ ...prev, context: 'all' }),
    })
    await navigateTo(router, { to: '/b' })
    expect(router.state.location.search).toEqual({ context: 'all' })
  })

  it('leaves the URL clean when context was never set', async () => {
    const router = await buildRouter('/a')
    await navigateTo(router, { to: '/b' })
    expect(router.state.location.searchStr).toBe('')
  })
})
