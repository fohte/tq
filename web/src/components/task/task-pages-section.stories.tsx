import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { TaskPagesSection } from '@web/components/task/task-pages-section'
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
  const taskPageRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/tasks/$taskId/pages/$pageId',
    component: () => null,
  })
  rootRoute.addChildren([indexRoute, taskPageRoute])

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

function Story({ taskId }: { taskId: string }) {
  return (
    <Providers>
      <div className="max-w-2xl p-6">
        <TaskPagesSection taskId={taskId} />
      </div>
    </Providers>
  )
}

const meta = {
  title: 'Task/TaskPages/Section',
  component: Story,
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof Story>

export default meta
type PageStory = StoryObj<typeof meta>

export const Default: PageStory = {
  args: { taskId: 'task-001' },
}
