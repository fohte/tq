import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { SidebarContent } from '#components/layout/sidebar'
import type { Project } from '#hooks/use-projects'
import { projectKeys } from '#hooks/use-projects'
import type { Task } from '#hooks/use-tasks'
import { taskKeys } from '#hooks/use-tasks'
import { StoryRouter } from '#storybook-config/story-router'

const baseTask: Task = {
  id: '00000000-0000-0000-0000-000000000001',
  number: 1,
  title: 'Implement task list UI',
  description: null,
  status: 'todo',
  context: 'personal',
  commitment: 'active',
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
