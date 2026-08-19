import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import type { ReactNode } from 'react'

type StoryRouterOptions = {
  component: () => ReactNode
  paths?: string[]
  initialPath?: string
}

// Child routes must be registered up front so a Link to that path resolves.
export function createStoryRouter({
  component,
  paths = [],
  initialPath = '/',
}: StoryRouterOptions) {
  const rootRoute = createRootRoute({
    validateSearch: (search: Record<string, unknown>) => search,
    component,
  })
  rootRoute.addChildren(
    [...new Set(['/', ...paths])].map((path) =>
      createRoute({
        getParentRoute: () => rootRoute,
        path,
        component: () => null,
      }),
    ),
  )

  return createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  })
}

// For stories that need the router memoized (e.g. across re-renders that
// would otherwise reset drag-and-drop state), call createStoryRouter directly.
export function StoryRouter(props: StoryRouterOptions) {
  return <RouterProvider router={createStoryRouter(props)} />
}
