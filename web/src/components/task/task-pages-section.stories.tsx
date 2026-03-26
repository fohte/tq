import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { TaskPagesList } from '@web/components/task/task-pages-section'
import type { TaskPage } from '@web/hooks/use-task-pages'
import type { ReactNode } from 'react'

const samplePages: TaskPage[] = [
  {
    id: 'page-001',
    taskId: 'task-001',
    title: 'Meeting Notes',
    content:
      '## Discussion Points\n\n- Architecture review\n- Sprint planning\n- Performance improvements\n\nWe decided to go with option B.',
    sortOrder: 0,
    createdAt: '2026-03-20T00:00:00.000Z',
    updatedAt: '2026-03-20T00:00:00.000Z',
  },
  {
    id: 'page-002',
    taskId: 'task-001',
    title: 'Technical Spec',
    content:
      '# API Design\n\nREST endpoints for the task management system.\n\n## Endpoints\n\n- GET /tasks\n- POST /tasks\n- PATCH /tasks/:id',
    sortOrder: 1,
    createdAt: '2026-03-21T00:00:00.000Z',
    updatedAt: '2026-03-21T00:00:00.000Z',
  },
  {
    id: 'page-003',
    taskId: 'task-001',
    title: 'Empty Page',
    content: '',
    sortOrder: 2,
    createdAt: '2026-03-22T00:00:00.000Z',
    updatedAt: '2026-03-22T00:00:00.000Z',
  },
]

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

// --- Section Stories ---

function SectionStory({
  taskId,
  pages,
}: {
  taskId: string
  pages: TaskPage[]
}) {
  return (
    <Providers>
      <div className="max-w-2xl p-6">
        <TaskPagesList taskId={taskId} pages={pages} onAddPage={() => {}} />
      </div>
    </Providers>
  )
}

const meta = {
  title: 'Task/TaskPages/Section',
  component: SectionStory,
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof SectionStory>

export default meta
type SectionStoryType = StoryObj<typeof meta>

export const WithPages: SectionStoryType = {
  args: { taskId: 'task-001', pages: samplePages },
}

export const Empty: SectionStoryType = {
  args: { taskId: 'task-empty', pages: [] },
}

export const SinglePage: SectionStoryType = {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- test data known to exist
  args: { taskId: 'task-single', pages: [samplePages[0]!] },
}
