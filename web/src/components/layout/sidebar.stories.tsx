import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { Sidebar } from '#components/layout/sidebar'
import { makeProject, makeTask } from '#components/layout/sidebar-test-fixtures'
import type { Project } from '#hooks/use-projects'
import { projectKeys } from '#hooks/use-projects'
import type { Task } from '#hooks/use-tasks'
import { taskKeys } from '#hooks/use-tasks'
import { StoryRouter } from '#storybook-config/story-router'

const tasksWithTags: Task[] = [
  makeTask({ id: '1', title: 'Task A', labels: ['dev:tq', 'urgent'] }),
  makeTask({ id: '2', title: 'Task B', labels: ['dev:tq'] }),
  makeTask({ id: '3', title: 'Task C', labels: ['review'] }),
]

const projectsAcrossStatuses: Project[] = [
  makeProject({
    id: '1',
    title: 'tq',
    status: 'active',
    taskCount: { completed: 12, total: 31 },
  }),
  makeProject({
    id: '2',
    title: 'Home renovation',
    status: 'paused',
    taskCount: { completed: 4, total: 9 },
  }),
  makeProject({
    id: '3',
    title: 'Q1 report',
    status: 'completed',
    taskCount: { completed: 8, total: 8 },
  }),
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
  return (
    <StoryRouter
      component={() => <SidebarStory tasks={tasks} projects={projects} />}
      initialPath={currentPath}
    />
  )
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
