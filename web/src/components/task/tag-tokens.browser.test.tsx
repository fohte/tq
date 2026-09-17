import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { TagTokens } from '#components/task/task-row-shared'
import { tagFilterSearch } from '#lib/tasks-query'

// The router's first route match resolves asynchronously even with no
// loaders, so router.load() is awaited before render() to avoid an initial
// blank paint (see https://tanstack.com/router/latest/docs/framework/react/guide/testing).
async function renderTagTokens(onOuterClick: () => void) {
  const rootRoute = createRootRoute({
    validateSearch: (search: Record<string, unknown>) => search,
    component: () => (
      <div onClick={onOuterClick}>
        <TagTokens labels={['dev:tq']} isCompleted={false} />
      </div>
    ),
  })
  // A tag token navigates to /tasks, so that route must be registered for
  // the navigation to resolve instead of erroring on an unmatched route.
  const tasksRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/tasks',
    component: () => null,
  })
  rootRoute.addChildren([tasksRoute])
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()

  return { ...render(<RouterProvider router={router} />), router }
}

describe('TagTokens', () => {
  it('navigates to /tasks scoped to the tag and stops the click from reaching an ancestor element', async () => {
    const user = userEvent.setup()
    const onOuterClick = vi.fn()
    const { router } = await renderTagTokens(onOuterClick)

    await user.click(screen.getByRole('button', { name: '#dev:tq' }))

    const observed: unknown[] = []
    observed.push(router.state.location.pathname)
    observed.push(router.state.location.search)
    observed.push(onOuterClick.mock.calls.length)

    expect(observed).toEqual(['/tasks', tagFilterSearch('dev:tq'), 0])
  })
})
