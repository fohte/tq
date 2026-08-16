import '#index.css'

import { QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { queryClient } from '#lib/query-client'
import { applyStandaloneViewport } from '#lib/standalone-viewport'
import { routeTree } from '#routeTree.gen'

applyStandaloneViewport()

const router = createRouter({ routeTree })

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
