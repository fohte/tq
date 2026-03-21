import '@web/index.css'

import { QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { ContextFilterProvider } from '@web/hooks/use-context-filter'
import { queryClient } from '@web/lib/query-client'
import { routeTree } from '@web/routeTree.gen'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

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
        <RouterProvider router={router} />
      </ContextFilterProvider>
    </QueryClientProvider>
  </StrictMode>,
)
