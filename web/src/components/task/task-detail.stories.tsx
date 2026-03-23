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
  TaskMainContent,
  TaskSidebar,
  TaskSidebarMobile,
} from '@web/components/task/task-detail'
import type { TaskPage } from '@web/hooks/use-task-pages'
import type { TaskDetail } from '@web/hooks/use-tasks'
import type { ReactNode } from 'react'

const samplePages: TaskPage[] = [
  {
    id: 'page-001',
    taskId: '550e8400-e29b-41d4-a716-446655440000',
    title: 'Meeting Notes',
    content:
      '## Discussion Points\n\n- Architecture review\n- Sprint planning\n- Performance improvements\n\nWe decided to go with option B.',
    sortOrder: 0,
    createdAt: '2026-03-20T00:00:00.000Z',
    updatedAt: '2026-03-20T00:00:00.000Z',
  },
  {
    id: 'page-002',
    taskId: '550e8400-e29b-41d4-a716-446655440000',
    title: 'Technical Spec',
    content:
      '# API Design\n\nREST endpoints for the task management system.\n\n## Endpoints\n\n- GET /tasks\n- POST /tasks\n- PATCH /tasks/:id',
    sortOrder: 1,
    createdAt: '2026-03-21T00:00:00.000Z',
    updatedAt: '2026-03-21T00:00:00.000Z',
  },
]

const baseTask: TaskDetail = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  title: 'Implement task detail page',
  description:
    '## Why\n\nThe task detail page is needed.\n\n## What\n\n- Add inline editing\n- Add sidebar fields',
  status: 'todo',
  context: 'dev',
  startDate: '2026-03-20',
  dueDate: '2026-03-25',
  estimatedMinutes: 90,
  parentId: null,
  projectId: null,
  sortOrder: 0,
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
  childCompletionCount: { completed: 1, total: 3 },
  pages: [],
  timeBlocks: [],
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
  const tasksRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/tasks',
    component: () => null,
  })
  const taskRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/tasks/$taskId',
    component: () => null,
  })
  const taskPageRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/tasks/$taskId/pages/$pageId',
    component: () => null,
  })
  rootRoute.addChildren([indexRoute, tasksRoute, taskRoute, taskPageRoute])

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

// --- TaskMainContent Stories ---

function MainContentStory({
  task,
  pages,
}: {
  task: TaskDetail
  pages: TaskPage[]
}) {
  return (
    <Providers>
      <div className="max-w-2xl p-6">
        <TaskMainContent task={task} pages={pages} />
      </div>
    </Providers>
  )
}

const mainContentMeta = {
  title: 'Task/TaskDetail/MainContent',
  component: MainContentStory,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof MainContentStory>

export default mainContentMeta
type Story = StoryObj<typeof mainContentMeta>

export const Default: Story = {
  args: {
    task: { ...baseTask },
    pages: [],
  },
}

export const InProgress: Story = {
  args: {
    task: { ...baseTask, status: 'in_progress', title: 'Review pull request' },
    pages: [],
  },
}

export const Completed: Story = {
  args: {
    task: {
      ...baseTask,
      status: 'completed',
      title: 'Set up CI pipeline',
    },
    pages: [],
  },
}

export const NoDescription: Story = {
  args: {
    task: { ...baseTask, description: null, title: 'Task without description' },
    pages: [],
  },
}

export const WithParent: Story = {
  args: {
    task: {
      ...baseTask,
      parentId: 'abcd0000-0000-0000-0000-000000000000',
      title: 'Subtask with parent',
    },
    pages: [],
  },
}

export const WithPages: Story = {
  args: {
    task: { ...baseTask, title: 'Task with pages' },
    pages: samplePages,
  },
}

// --- TaskSidebar Stories ---

export const Sidebar: StoryObj<{ task: TaskDetail }> = {
  args: {
    task: { ...baseTask },
  },
  render: ({ task }) => (
    <Providers>
      <div className="w-60 border-l border-border p-4">
        <TaskSidebar task={task} />
      </div>
    </Providers>
  ),
}

export const SidebarMinimal: StoryObj<{ task: TaskDetail }> = {
  args: {
    task: {
      ...baseTask,
      estimatedMinutes: null,
      startDate: null,
      dueDate: null,
      parentId: null,
      context: 'personal',
    },
  },
  render: ({ task }) => (
    <Providers>
      <div className="w-60 border-l border-border p-4">
        <TaskSidebar task={task} />
      </div>
    </Providers>
  ),
}

// --- TaskSidebarMobile Stories ---

export const MobileSidebar: StoryObj<{ task: TaskDetail }> = {
  args: {
    task: { ...baseTask },
  },
  render: ({ task }) => (
    <Providers>
      <div className="max-w-sm border-t border-border p-4">
        <TaskSidebarMobile task={task} />
      </div>
    </Providers>
  ),
}

// --- Full Page Layout ---

export const FullPagePC: StoryObj<{ task: TaskDetail; pages: TaskPage[] }> = {
  args: {
    task: { ...baseTask },
    pages: samplePages,
  },
  parameters: {
    layout: 'fullscreen',
  },
  render: ({ task, pages }) => (
    <Providers>
      <div className="flex h-screen">
        <div className="flex-1 overflow-y-auto p-6">
          <TaskMainContent task={task} pages={pages} />
        </div>
        <div className="w-60 shrink-0 overflow-y-auto border-l border-border p-4">
          <TaskSidebar task={task} />
        </div>
      </div>
    </Providers>
  ),
}

export const FullPageSP: StoryObj<{ task: TaskDetail; pages: TaskPage[] }> = {
  args: {
    task: { ...baseTask },
    pages: samplePages,
  },
  parameters: {
    layout: 'fullscreen',
    viewport: { defaultViewport: 'mobile1' },
  },
  render: ({ task, pages }) => (
    <Providers>
      <div className="flex h-screen flex-col overflow-y-auto">
        <div className="p-4">
          <TaskMainContent task={task} pages={pages} />
        </div>
        <div className="border-t border-border p-4">
          <TaskSidebarMobile task={task} />
        </div>
      </div>
    </Providers>
  ),
}
