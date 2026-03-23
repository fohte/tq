import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { PageCardPresentation } from '@web/components/task/task-pages-section'
import { MarkdownEditor } from '@web/components/ui/markdown-editor'
import type { TaskPage } from '@web/hooks/use-task-pages'
import type { ReactNode } from 'react'

const samplePage: TaskPage = {
  id: 'page-001',
  taskId: 'task-001',
  title: 'Meeting Notes',
  content:
    '## Discussion Points\n\n- Architecture review\n- Sprint planning\n- Performance improvements\n\nWe decided to go with option B.',
  sortOrder: 0,
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
}

const emptyPage: TaskPage = {
  id: 'page-003',
  taskId: 'task-001',
  title: 'Empty Page',
  content: '',
  sortOrder: 2,
  createdAt: '2026-03-22T00:00:00.000Z',
  updatedAt: '2026-03-22T00:00:00.000Z',
}

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

function Story({ page, isExpanded }: { page: TaskPage; isExpanded: boolean }) {
  return (
    <Providers>
      <div className="max-w-2xl p-6">
        <PageCardPresentation
          taskId={page.taskId}
          page={page}
          onDelete={() => {}}
          isExpanded={isExpanded}
          renderEditor={(defaultValue) => (
            <div className="min-h-[80px] text-sm">
              <MarkdownEditor
                defaultValue={defaultValue}
                placeholder="Write something..."
              />
            </div>
          )}
        />
      </div>
    </Providers>
  )
}

const meta = {
  title: 'Task/TaskPages/PageCard',
  component: Story,
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof Story>

export default meta
type CardStory = StoryObj<typeof meta>

export const Collapsed: CardStory = {
  args: { page: samplePage, isExpanded: false },
}

export const Expanded: CardStory = {
  args: { page: samplePage, isExpanded: true },
}

export const EmptyContent: CardStory = {
  args: { page: emptyPage, isExpanded: false },
}
