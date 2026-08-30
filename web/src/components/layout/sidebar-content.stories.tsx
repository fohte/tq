import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { SidebarContent } from '#components/layout/sidebar'
import { makeProject, makeTask } from '#components/layout/sidebar-test-fixtures'
import type { Project } from '#hooks/use-projects'
import { projectKeys } from '#hooks/use-projects'
import type { Task } from '#hooks/use-tasks'
import { taskKeys } from '#hooks/use-tasks'
import { StoryRouter } from '#storybook-config/story-router'

const tasksWithTags: Task[] = [
  makeTask({ id: '1', title: 'Task A', labels: ['dev:tq', 'urgent'] }),
  makeTask({ id: '2', title: 'Task B', labels: ['dev:tq'] }),
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
]

function SidebarContentStory() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  queryClient.setQueryData(taskKeys.list(undefined), tasksWithTags)
  queryClient.setQueryData(projectKeys.list(undefined), projectsAcrossStatuses)

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex h-dvh w-full flex-col">
        <SidebarContent />
      </div>
    </QueryClientProvider>
  )
}

function SidebarContentWithRouter() {
  return <StoryRouter component={SidebarContentStory} />
}

const meta = {
  title: 'Layout/SidebarContent',
  component: SidebarContentWithRouter,
  tags: ['mobile-only'],
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof SidebarContentWithRouter>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
