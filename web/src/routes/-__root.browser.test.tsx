import {
  createMemoryHistory,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { act, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Route as RootRoute } from '#routes/__root'

vi.mock('#components/layout/app-layout', () => ({
  AppLayout: ({ children }: { children: ReactNode }) => (
    <main data-testid="app-layout">{children}</main>
  ),
}))

vi.mock('#hooks/use-github-link', () => ({ useGithubSync: () => {} }))
vi.mock('#hooks/use-push-notifications', () => ({
  usePushResubscribe: () => {},
}))
vi.mock('#hooks/use-service-worker-update', () => ({
  useServiceWorkerUpdate: () => {},
}))

let navigateRequestListener: ((path: string) => void) | undefined
const onNavigateRequest = vi.fn((listener: (path: string) => void) => {
  navigateRequestListener = listener
  return () => {
    navigateRequestListener = undefined
  }
})

function validateHomeSearch(search: Record<string, unknown>) {
  return search['layout'] === 'compact' ? { layout: 'compact' as const } : {}
}

const HomeRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: '/',
  validateSearch: validateHomeSearch,
  component: () => <span data-testid="home">home</span>,
})

const TaskRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: '/tasks/$taskId',
  component: () => <span data-testid="task">task</span>,
})

const routeTree = RootRoute.addChildren([HomeRoute, TaskRoute])

async function renderRootRoute(initialEntry: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  })
  await router.load()
  render(<RouterProvider router={router} />)
  return router
}

function mainNavigationResult(subscriptionCount: number, href: string) {
  return { subscriptionCount, href }
}

function compactNavigationResult(requests: [path: string][], href: string) {
  return { requests, href }
}

function compactLayoutResult(
  subscriptionCount: number,
  hasCompactFrame: boolean,
  hasAppLayout: boolean,
) {
  return { subscriptionCount, hasCompactFrame, hasAppLayout }
}

describe('RootRoute desktop navigation', () => {
  const openInMainWindow = vi.fn<(path: string) => void>()

  beforeEach(() => {
    vi.clearAllMocks()
    navigateRequestListener = undefined
    window.tqDesktop = {
      openInMainWindow,
      onNavigateRequest,
    }
  })

  afterEach(() => {
    delete window.tqDesktop
  })

  it('navigates the main window to the requested href without reloading', async () => {
    const path = '/tasks/task-123?source=compact#comments'
    const router = await renderRootRoute('/tasks/task-current')

    act(() => {
      if (navigateRequestListener != null) {
        navigateRequestListener(path)
      }
    })
    await screen.findByTestId('task')

    expect(
      mainNavigationResult(
        onNavigateRequest.mock.calls.length,
        router.state.location.href,
      ),
    ).toEqual({ subscriptionCount: 1, href: path })
  })

  it('does not subscribe to navigation requests in compact layout', async () => {
    await renderRootRoute('/?layout=compact')

    expect(
      compactLayoutResult(
        onNavigateRequest.mock.calls.length,
        document.querySelector('.h-dvh') != null,
        screen.queryByTestId('app-layout') != null,
      ),
    ).toEqual({
      subscriptionCount: 0,
      hasCompactFrame: true,
      hasAppLayout: false,
    })
  })

  it('opens navigations from compact layout in the main window and keeps its location', async () => {
    const router = await renderRootRoute('/?layout=compact')

    await act(async () => {
      await router.navigate({
        href: '/tasks/task-123?source=compact',
      })
    })

    expect(
      compactNavigationResult(
        openInMainWindow.mock.calls,
        router.state.location.href,
      ),
    ).toEqual({
      requests: [['/tasks/task-123?source=compact']],
      href: '/?layout=compact',
    })
  })

  it('allows search-only navigations from compact layout in the same window', async () => {
    const router = await renderRootRoute('/?layout=compact')

    await act(async () => {
      await router.navigate({ href: '/?layout=compact&refresh=1' })
    })

    expect(
      compactNavigationResult(
        openInMainWindow.mock.calls,
        router.state.location.href,
      ),
    ).toEqual({
      requests: [],
      href: '/?layout=compact&refresh=1',
    })
  })

  it('allows compact-layout navigations when the desktop API is unavailable', async () => {
    delete window.tqDesktop
    const router = await renderRootRoute('/?layout=compact')

    await act(async () => {
      await router.navigate({ href: '/tasks/task-123' })
    })

    expect(
      compactNavigationResult(
        openInMainWindow.mock.calls,
        router.state.location.href,
      ),
    ).toEqual({ requests: [], href: '/tasks/task-123' })
  })

  it('allows navigations from non-compact routes with a compact search parameter', async () => {
    const router = await renderRootRoute('/tasks/task-current?layout=compact')

    await act(async () => {
      await router.navigate({
        href: '/tasks/task-next?layout=compact',
      })
    })

    expect(
      compactNavigationResult(
        openInMainWindow.mock.calls,
        router.state.location.href,
      ),
    ).toEqual({
      requests: [],
      href: '/tasks/task-next?layout=compact',
    })
  })
})
