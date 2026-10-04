import {
  createMemoryHistory,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { Route as RootRoute } from '#routes/__root'

vi.mock('#components/layout/app-layout', () => ({
  AppLayout: ({ children }: { children: ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
}))

vi.mock('#hooks/use-github-link', () => ({ useGithubSync: () => {} }))
vi.mock('#hooks/use-push-notifications', () => ({
  usePushResubscribe: () => {},
}))
vi.mock('#hooks/use-service-worker-update', () => ({
  useServiceWorkerUpdate: () => {},
}))

const indexRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: '/',
  validateSearch: (search: Record<string, unknown>) => search,
  component: () => <div data-testid="route-content" />,
})
const taskRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: '/tasks/$taskId',
  validateSearch: (search: Record<string, unknown>) => search,
  component: () => <div data-testid="task-content" />,
})
const testRootRoute = RootRoute.addChildren([indexRoute, taskRoute])

async function renderRoot(initialEntry: string) {
  const router = createRouter({
    routeTree: testRootRoute,
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  })
  await router.load()
  return render(<RouterProvider router={router} />)
}

describe('root route layout', () => {
  it('omits AppLayout for the compact day route', async () => {
    const { container } = await renderRoot('/?layout=compact')

    const getCompactRouteState = () => ({
      appLayoutVisible: screen.queryByTestId('app-layout') != null,
      routeContentVisible: screen.queryByTestId('route-content') != null,
      viewportHeightWrapper:
        container.firstElementChild?.classList.contains('h-dvh') ?? false,
    })
    expect(getCompactRouteState()).toEqual({
      appLayoutVisible: false,
      routeContentVisible: true,
      viewportHeightWrapper: true,
    })
  })

  it('keeps AppLayout on other routes when the compact query is present', async () => {
    await renderRoot('/tasks/task-1?layout=compact')

    const getNonRootRouteState = () => ({
      appLayoutVisible: screen.queryByTestId('app-layout') != null,
      taskContentVisible: screen.queryByTestId('task-content') != null,
    })
    expect(getNonRootRouteState()).toEqual({
      appLayoutVisible: true,
      taskContentVisible: true,
    })
  })
})
