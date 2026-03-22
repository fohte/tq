import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { TaskPageEditor } from '@web/components/task/task-page-editor'
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
  rootRoute.addChildren([indexRoute])

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

function Story({ taskId, pageId }: { taskId: string; pageId: string }) {
  return (
    <Providers>
      <div className="h-screen">
        <TaskPageEditor taskId={taskId} pageId={pageId} />
      </div>
    </Providers>
  )
}

const meta = {
  title: 'Task/TaskPages/Editor',
  component: Story,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof Story>

export default meta
type EditorStory = StoryObj<typeof meta>

export const Default: EditorStory = {
  args: { taskId: 'task-001', pageId: 'page-001' },
}
