import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '@web/index.css'

import { RouterProvider, createRouter } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'

import { queryClient } from '@web/lib/query-client'
import { routeTree } from '@web/routeTree.gen'

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
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
