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
import type { Project } from '#hooks/use-projects'
import { projectKeys } from '#hooks/use-projects'
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
  recurrenceRuleId: null,
  githubLink: null,
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
  childCompletionCount: { completed: 0, total: 0 },
}

const tasksWithTags: Task[] = [
  { ...baseTask, id: '1', title: 'Task A', labels: ['dev:tq', 'urgent'] },
  { ...baseTask, id: '2', title: 'Task B', labels: ['dev:tq'] },
  { ...baseTask, id: '3', title: 'Task C', labels: ['review'] },
]

const baseProject: Project = {
  id: '00000000-0000-0000-0000-000000000101',
  title: 'tq',
  description: null,
  status: 'active',
  startDate: null,
  targetDate: null,
  color: null,
  sortOrder: 0,
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
  completionRate: 0,
  taskCount: { total: 0, completed: 0 },
}

const projectsAcrossStatuses: Project[] = [
  {
    ...baseProject,
    id: '1',
    title: 'tq',
    status: 'active',
    taskCount: { completed: 12, total: 31 },
  },
  {
    ...baseProject,
    id: '2',
    title: 'Home renovation',
    status: 'paused',
    taskCount: { completed: 4, total: 9 },
  },
  {
    ...baseProject,
    id: '3',
    title: 'Q1 report',
    status: 'completed',
    taskCount: { completed: 8, total: 8 },
  },
]

function SidebarStory({
  tasks,
  projects,
}: {
  tasks?: Task[] | undefined
  projects?: Project[] | undefined
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  queryClient.setQueryData(taskKeys.list(undefined), tasks ?? [])
  queryClient.setQueryData(projectKeys.list(undefined), projects ?? [])

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
  projects,
}: {
  currentPath: string
  tasks?: Task[] | undefined
  projects?: Project[] | undefined
}) {
  const rootRoute = createRootRoute({
    validateSearch: (search: Record<string, unknown>) => search,
    component: () => <SidebarStory tasks={tasks} projects={projects} />,
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
  tags: ['desktop-only'],
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    currentPath: {
      control: 'select',
      options: ['/', '/tasks', '/today', '/projects', '/settings'],
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

export const WithProjects: Story = {
  args: {
    currentPath: '/',
    projects: projectsAcrossStatuses,
  },
}
