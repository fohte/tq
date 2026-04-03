import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { SearchView } from '@web/components/search/search-view'
import type { ReactNode } from 'react'

function Providers({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const rootRoute = createRootRoute({
    component: () => <>{children}</>,
  })
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => null,
  })
  const taskRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/tasks/$taskId',
    component: () => null,
  })
  rootRoute.addChildren([indexRoute, taskRoute])

  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

const meta = {
  title: 'Search/SearchView',
  component: SearchView,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <Providers>
        <div className="h-[844px] w-[390px] bg-background">
          <Story />
        </div>
      </Providers>
    ),
  ],
} satisfies Meta<typeof SearchView>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    onBack: () => {},
  },
}

export const WithBackButton: Story = {
  args: {
    onBack: () => {},
  },
}

export const NoBackButton: Story = {
  args: {},
}
