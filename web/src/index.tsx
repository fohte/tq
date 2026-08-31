import '#index.css'

import { QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { queryClient } from '#lib/query-client'
import { applyStandaloneViewport } from '#lib/standalone-viewport'
import { routeTree } from '#routeTree.gen'

applyStandaloneViewport()

const router = createRouter({
  routeTree,
  // Remounts a route's component whenever its path params change, even when
  // the previous and next matches are both already cached (e.g. browsing
  // /tasks/A -> /tasks/B -> back to /tasks/A). Without this, TanStack Router
  // reuses the mounted component across the param change (see MatchInner in
  // @tanstack/react-router), leaving uncontrolled local state — like the
  // Crepe editor instance backing the description field — stuck on the
  // previous entity's data.
  defaultRemountDeps: ({ params }) => params,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const root = document.getElementById('root')
if (!root) {
  // eslint-disable-next-line no-restricted-syntax -- startup boundary: no caller exists yet to hand a Result to
  throw new Error('Failed to find the root element.')
}

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
