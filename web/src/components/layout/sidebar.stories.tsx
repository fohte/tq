import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'

import { Sidebar } from '#components/layout/sidebar'
import type { Task } from '#hooks/use-tasks'
import { taskKeys } from '#hooks/use-tasks'

const baseTask: Task = {
  id: '00000000-0000-0000-0000-000000000001',
  number: 1,
  title: 'Implement task list UI',
  description: null,
  status: 'todo',
  context: 'personal',
  labels: [],
  startDate: null,
  dueDate: null,
  estimatedMinutes: null,
  parentId: null,
  parentNumber: null,
  projectId: null,
  sortOrder: 0,
  recurrenceRuleId: null,
  recurrenceRule: null,
  githubLink: null,
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
}

const tasksWithTags: Task[] = [
  { ...baseTask, id: '1', title: 'Task A', labels: ['dev:tq', 'urgent'] },
  { ...baseTask, id: '2', title: 'Task B', labels: ['dev:tq'] },
  { ...baseTask, id: '3', title: 'Task C', labels: ['review'] },
]

function SidebarStory({ tasks }: { tasks?: Task[] | undefined }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  queryClient.setQueryData(taskKeys.list(undefined), tasks ?? [])

  return (
    <QueryClientProvider client={queryClient}>
      <div className="h-screen md:flex">
        <Sidebar />
      </div>
    </QueryClientProvider>
  )
}

function SidebarWithRouter({
  currentPath,
  tasks,
}: {
  currentPath: string
  tasks?: Task[] | undefined
}) {
  const rootRoute = createRootRoute({
    component: () => <SidebarStory tasks={tasks} />,
  })
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
  title: 'Layout/Sidebar',
  component: SidebarWithRouter,
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    currentPath: {
      control: 'select',
      options: ['/', '/tasks', '/search', '/today', '/projects', '/settings'],
    },
  },
} satisfies Meta<typeof SidebarWithRouter>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    currentPath: '/',
  },
}

export const TasksActive: Story = {
  args: {
    currentPath: '/tasks',
  },
}

export const SearchActive: Story = {
  args: {
    currentPath: '/search',
  },
}

export const ProjectsActive: Story = {
  args: {
    currentPath: '/projects',
  },
}

export const SettingsActive: Story = {
  args: {
    currentPath: '/settings',
  },
}

export const WithTags: Story = {
  args: {
    currentPath: '/',
    tasks: tasksWithTags,
  },
}
