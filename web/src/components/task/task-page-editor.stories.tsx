import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import {
  PageEditorInner,
  SubpageViewPresentation,
} from '@web/components/task/task-page-editor'
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

function Story({
  taskId,
  pageId,
  defaultTitle,
  defaultContent,
}: {
  taskId: string
  pageId: string
  defaultTitle: string
  defaultContent: string
}) {
  return (
    <Providers>
      <div className="h-screen">
        <SubpageViewPresentation taskId={taskId} pageTitle={defaultTitle}>
          <PageEditorInner
            taskId={taskId}
            pageId={pageId}
            defaultTitle={defaultTitle}
            defaultContent={defaultContent}
          />
        </SubpageViewPresentation>
      </div>
    </Providers>
  )
}

const meta = {
  title: 'Task/TaskPages/SubpageView',
  component: Story,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof Story>

export default meta
type SubpageStory = StoryObj<typeof meta>

export const Default: SubpageStory = {
  args: {
    taskId: 'task-001',
    pageId: 'page-001',
    defaultTitle: 'Meeting Notes',
    defaultContent:
      '## Discussion Points\n\n- Architecture review\n- Sprint planning\n- Performance improvements\n\nWe decided to go with option B for the following reasons:\n\n1. Better performance\n2. Simpler architecture\n3. Easier to maintain',
  },
}

export const Empty: SubpageStory = {
  args: {
    taskId: 'task-001',
    pageId: 'page-002',
    defaultTitle: 'Untitled',
    defaultContent: '',
  },
}
