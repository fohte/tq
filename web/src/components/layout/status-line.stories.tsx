import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'

import { StatusLine } from '#components/layout/status-line'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

function StatusLineStory() {
  return (
    <QueryClientProvider client={queryClient}>
      <StatusLine />
    </QueryClientProvider>
  )
}

function StatusLineWithRouter({ currentPath }: { currentPath: string }) {
  const rootRoute = createRootRoute({ component: StatusLineStory })
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => null,
  })
  rootRoute.addChildren([indexRoute])

  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: [currentPath] }),
  })

  return <RouterProvider router={router} />
}

const meta = {
  title: 'Layout/StatusLine',
  component: StatusLineWithRouter,
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    currentPath: {
      control: 'select',
      options: ['/', '/tasks', '/today', '/projects'],
    },
  },
} satisfies Meta<typeof StatusLineWithRouter>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    currentPath: '/',
  },
}

export const TasksPath: Story = {
  args: {
    currentPath: '/tasks',
  },
}
