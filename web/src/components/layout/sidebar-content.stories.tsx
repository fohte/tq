import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { SidebarContent } from '#components/layout/sidebar'
import {
  makeLabel,
  makeProject,
  makeSavedView,
  makeTask,
} from '#components/layout/sidebar-test-fixtures'
import type { Label } from '#hooks/use-labels'
import { labelKeys } from '#hooks/use-labels'
import type { Project } from '#hooks/use-projects'
import { projectKeys } from '#hooks/use-projects'
import type { SavedView } from '#hooks/use-saved-views'
import { savedViewKeys } from '#hooks/use-saved-views'
import type { Task } from '#hooks/use-tasks'
import { taskKeys } from '#hooks/use-tasks'
import { StoryRouter } from '#storybook-config/story-router'

const tasksWithTags: Task[] = [
  makeTask({ id: '1', title: 'Task A', labels: ['dev:tq', 'urgent'] }),
  makeTask({ id: '2', title: 'Task B', labels: ['dev:tq'] }),
]

const labelsForTasksWithTags = [
  makeLabel({ id: '1', name: 'dev:tq' }),
  makeLabel({ id: '2', name: 'urgent' }),
]

const tasksWithNestedTags: Task[] = [
  makeTask({ id: '4', title: 'Task X', labels: ['dev/tq'] }),
  makeTask({ id: '5', title: 'Task Y', labels: ['dev/infra'] }),
]

const labelsForNestedTags = [
  makeLabel({ id: '4', name: 'dev/tq' }),
  makeLabel({ id: '5', name: 'dev/infra' }),
]

const tasksWithInboxItems: Task[] = [
  makeTask({ id: '3', title: 'Untriaged task', commitment: 'inbox' }),
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

const savedViews: SavedView[] = [
  makeSavedView({ id: '1', name: 'Now', query: 'commitment:active' }),
  makeSavedView({ id: '2', name: 'Someday', query: 'commitment:someday' }),
]

function SidebarContentStory({
  tasks = tasksWithTags,
  labels = labelsForTasksWithTags,
}: {
  tasks?: Task[]
  labels?: Label[]
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  queryClient.setQueryData(taskKeys.list(undefined), tasks)
  queryClient.setQueryData(
    taskKeys.list({ context: 'personal', commitment: 'inbox', status: 'todo' }),
    tasks.filter(
      (task) => task.commitment === 'inbox' && task.status === 'todo',
    ),
  )
  queryClient.setQueryData(
    projectKeys.list({ context: 'personal' }),
    projectsAcrossStatuses,
  )
  queryClient.setQueryData(
    savedViewKeys.list({ context: 'personal' }),
    savedViews,
  )
  queryClient.setQueryData(labelKeys.list({ context: 'personal' }), labels)

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex h-dvh w-full flex-col">
        <SidebarContent />
      </div>
    </QueryClientProvider>
  )
}

function SidebarContentWithRouter({
  tasks,
  labels,
}: {
  tasks?: Task[]
  labels?: Label[]
}) {
  return (
    <StoryRouter
      component={() => (
        <SidebarContentStory
          {...(tasks != null ? { tasks } : {})}
          {...(labels != null ? { labels } : {})}
        />
      )}
    />
  )
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

export const WithNestedTags: Story = {
  args: {
    tasks: tasksWithNestedTags,
    labels: labelsForNestedTags,
  },
}

export const WithInboxTasks: Story = {
  args: {
    tasks: tasksWithInboxItems,
  },
}
