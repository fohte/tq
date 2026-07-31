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

import {
  TaskSidebar,
  TaskSidebarMobile,
} from '#components/task/task-detail-sidebar'
import type { TaskDetail } from '#hooks/use-tasks'

const baseTask: TaskDetail = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  number: 1,
  title: 'Implement task detail page',
  description:
    '## Why\n\nThe task detail page is needed.\n\n## What\n\n- Add inline editing\n- Add sidebar fields',
  status: 'todo',
  context: 'personal',
  startDate: '2026-03-20',
  dueDate: '2026-03-25',
  estimatedMinutes: 90,
  parentId: null,
  projectId: null,
  sortOrder: 0,
  recurrenceRuleId: null,
  recurrenceRule: null,
  githubLink: null,
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
  titleAuthor: null,
  descriptionAuthor: null,
  childCompletionCount: { completed: 1, total: 3 },
  pages: [],
  timeBlocks: [],
  links: { outgoing: [], incoming: [] },
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
  rootRoute.addChildren([indexRoute, tasksRoute, taskRoute])

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

function SidebarStory({ task }: { task: TaskDetail }) {
  return (
    <Providers>
      <div className="w-60 border-l border-border p-4">
        <TaskSidebar task={task} />
      </div>
    </Providers>
  )
}

const meta = {
  title: 'Task/TaskDetail/Sidebar',
  component: SidebarStory,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof SidebarStory>

export default meta
type Story = StoryObj<typeof meta>

export const Sidebar: Story = {
  args: {
    task: { ...baseTask },
  },
}

export const SidebarMinimal: Story = {
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
}

export const SidebarWithGithubLink: Story = {
  args: {
    task: {
      ...baseTask,
      githubLink: {
        id: 'link-1',
        owner: 'fohte',
        repo: 'tq',
        number: 42,
        kind: 'issue',
        url: 'https://github.com/fohte/tq/issues/42',
        state: 'open',
        title: 'Implement task detail page',
        lastSyncedAt: '2026-03-20T00:00:00.000Z',
      },
    },
  },
}

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
