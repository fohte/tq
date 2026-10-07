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
import type { Project } from '#hooks/use-projects'
import { projectKeys } from '#hooks/use-projects'
import type { SavedView } from '#hooks/use-saved-views'
import type { Task } from '#hooks/use-tasks'
import { taskKeys } from '#hooks/use-tasks'
import { labelKeys, savedViewKeys } from '#lib/query-keys'
import type { TagCount } from '#lib/tag-tree'
import { makeTagCount } from '#lib/tag-tree-test-fixtures'
import { StoryRouter } from '#storybook-config/story-router'

const tagCountsWithTags: TagCount[] = [
  makeTagCount({ name: 'dev:tq', count: 2 }),
  makeTagCount({ name: 'urgent', count: 1 }),
]

const labelsForTasksWithTags = [
  makeLabel({ id: '1', name: 'dev:tq' }),
  makeLabel({ id: '2', name: 'urgent' }),
]

const tagCountsWithNestedTags: TagCount[] = [
  makeTagCount({ name: 'dev', count: 2 }),
  makeTagCount({ name: 'dev/tq', count: 1 }),
  makeTagCount({ name: 'dev/infra', count: 1 }),
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
  tasks = [],
  labels = labelsForTasksWithTags,
  tagCounts = tagCountsWithTags,
}: {
  tasks?: Task[]
  labels?: Label[]
  tagCounts?: TagCount[]
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  queryClient.setQueryData(taskKeys.labelCounts('personal'), tagCounts)
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
  tagCounts,
}: {
  tasks?: Task[]
  labels?: Label[]
  tagCounts?: TagCount[]
}) {
  return (
    <StoryRouter
      component={() => (
        <SidebarContentStory
          {...(tasks != null ? { tasks } : {})}
          {...(labels != null ? { labels } : {})}
          {...(tagCounts != null ? { tagCounts } : {})}
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

export const Default: Story = {
  name: 'the sidebar shows task and label navigation',
}

export const WithNestedTags: Story = {
  name: 'the sidebar groups tasks under nested labels',
  args: {
    tagCounts: tagCountsWithNestedTags,
    labels: labelsForNestedTags,
  },
}

export const WithInboxTasks: Story = {
  name: 'the sidebar includes a task in the inbox section',
  args: {
    tasks: tasksWithInboxItems,
    tagCounts: [],
  },
}
