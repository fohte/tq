import '#index.css'

import { QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { ContextFilterProvider } from '#hooks/use-context-filter'
import { TagFilterProvider } from '#hooks/use-tag-filter'
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
  throw new Error('Failed to find the root element.')
}

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ContextFilterProvider>
        <TagFilterProvider>
          <RouterProvider router={router} />
        </TagFilterProvider>
      </ContextFilterProvider>
    </QueryClientProvider>
  </StrictMode>,
)
