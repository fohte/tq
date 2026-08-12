import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { PageCardPresentation } from '#components/task/task-pages-section'
import { HtmlPageEditor } from '#components/ui/html-page-editor'
import { MarkdownEditor } from '#components/ui/markdown-editor'
import type { TaskPage } from '#hooks/use-task-pages'

const samplePage: TaskPage = {
  id: 'page-001',
  taskId: 'task-001',
  title: 'Meeting Notes',
  content:
    '## Discussion Points\n\n- Architecture review\n- Sprint planning\n- Performance improvements\n\nWe decided to go with option B.',
  format: 'markdown',
  sortOrder: 0,
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
  author: null,
}

const emptyPage: TaskPage = {
  id: 'page-003',
  taskId: 'task-001',
  title: 'Empty Page',
  content: '',
  format: 'markdown',
  sortOrder: 2,
  createdAt: '2026-03-22T00:00:00.000Z',
  updatedAt: '2026-03-22T00:00:00.000Z',
  author: null,
}

const htmlPage: TaskPage = {
  id: 'page-004',
  taskId: 'task-001',
  title: 'Dashboard Mockup',
  content:
    '<!doctype html><html><body style="font-family: sans-serif; margin: 0; padding: 16px;"><h1>Dashboard</h1></body></html>',
  format: 'html',
  sortOrder: 3,
  createdAt: '2026-03-23T00:00:00.000Z',
  updatedAt: '2026-03-23T00:00:00.000Z',
  author: null,
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

function Story({
  page,
  isExpanded,
  deleteDialogOpen,
}: {
  page: TaskPage
  isExpanded: boolean
  deleteDialogOpen: boolean
}) {
  return (
    <Providers>
      <div className="max-w-2xl p-6">
        <PageCardPresentation
          taskId={page.taskId}
          page={page}
          onDelete={() => {}}
          isExpanded={isExpanded}
          deleteDialogOpen={deleteDialogOpen}
          renderEditor={(defaultValue) =>
            page.format === 'html' ? (
              <div className="text-sm">
                <HtmlPageEditor defaultValue={defaultValue} />
              </div>
            ) : (
              <div className="text-sm">
                <MarkdownEditor
                  defaultValue={defaultValue}
                  placeholder="Write something..."
                  size="compact"
                />
              </div>
            )
          }
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
  args: { page: samplePage, isExpanded: false, deleteDialogOpen: false },
}

export const Expanded: CardStory = {
  args: { page: samplePage, isExpanded: true, deleteDialogOpen: false },
}

export const DeleteConfirmation: CardStory = {
  args: { page: samplePage, isExpanded: false, deleteDialogOpen: true },
}

export const EmptyContent: CardStory = {
  args: { page: emptyPage, isExpanded: false, deleteDialogOpen: false },
}

export const LlmAuthored: CardStory = {
  args: {
    page: { ...samplePage, author: { kind: 'llm', agent: 'claude-opus-5' } },
    isExpanded: false,
    deleteDialogOpen: false,
  },
}

export const HtmlCollapsed: CardStory = {
  args: { page: htmlPage, isExpanded: false, deleteDialogOpen: false },
}

export const HtmlExpanded: CardStory = {
  args: { page: htmlPage, isExpanded: true, deleteDialogOpen: false },
}
