import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { Sidebar } from '#components/layout/sidebar'
import {
  makeLabel,
  makeProject,
  makeSavedView,
} from '#components/layout/sidebar-test-fixtures'
import type { Label } from '#hooks/use-labels'
import type { Project } from '#hooks/use-projects'
import { projectKeys } from '#hooks/use-projects'
import type { SavedView } from '#hooks/use-saved-views'
import { taskKeys } from '#hooks/use-tasks'
import { labelKeys, savedViewKeys } from '#lib/query-keys'
import type { TagCount } from '#lib/tag-tree'
import { makeTagCount } from '#lib/tag-tree-test-fixtures'
import { StoryRouter } from '#storybook-config/story-router'

const tagCountsWithTags: TagCount[] = [
  makeTagCount({ name: 'dev:tq', count: 2 }),
  makeTagCount({ name: 'urgent', count: 1 }),
  makeTagCount({ name: 'review', count: 1 }),
]

const labelsForTasksWithTags = [
  makeLabel({ id: '1', name: 'dev:tq' }),
  makeLabel({ id: '2', name: 'urgent' }),
  makeLabel({ id: '3', name: 'review' }),
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
  inboxCount,
  projects,
  savedViews,
  labels,
  tagCounts,
  desktopWindowControls,
}: {
  inboxCount?: number | undefined
  projects?: Project[] | undefined
  savedViews?: SavedView[] | undefined
  labels?: Label[] | undefined
  tagCounts?: TagCount[] | undefined
  desktopWindowControls?: boolean | undefined
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  queryClient.setQueryData(taskKeys.labelCounts('personal'), tagCounts ?? [])
  queryClient.setQueryData(
    taskKeys.count({
      context: 'personal',
      commitment: 'inbox',
      status: 'todo',
    }),
    inboxCount ?? 0,
  )
  queryClient.setQueryData(
    projectKeys.list({ context: 'personal', status: 'all' }),
    projects ?? [],
  )
  queryClient.setQueryData(
    savedViewKeys.list({ context: 'personal' }),
    savedViews ?? [],
  )
  queryClient.setQueryData(
    labelKeys.list({ context: 'personal' }),
    labels ?? [],
  )

  return (
    <QueryClientProvider client={queryClient}>
      <div className="h-screen md:flex">
        <Sidebar desktopWindowControls={desktopWindowControls} />
      </div>
    </QueryClientProvider>
  )
}

function SidebarWithRouter({
  currentPath,
  inboxCount,
  projects,
  savedViews,
  labels,
  tagCounts,
  desktopWindowControls,
}: {
  currentPath: string
  inboxCount?: number | undefined
  projects?: Project[] | undefined
  savedViews?: SavedView[] | undefined
  labels?: Label[] | undefined
  tagCounts?: TagCount[] | undefined
  desktopWindowControls?: boolean | undefined
}) {
  return (
    <StoryRouter
      component={() => (
        <SidebarStory
          inboxCount={inboxCount}
          projects={projects}
          savedViews={savedViews}
          labels={labels}
          tagCounts={tagCounts}
          desktopWindowControls={desktopWindowControls}
        />
      )}
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
  name: 'the sidebar shows its default navigation sections',
  args: {
    currentPath: '/',
  },
}

export const TasksActive: Story = {
  name: 'the sidebar highlights the tasks route',
  args: {
    currentPath: '/tasks',
  },
}

export const ProjectsActive: Story = {
  name: 'the sidebar highlights the projects route',
  args: {
    currentPath: '/projects',
  },
}

export const SettingsActive: Story = {
  name: 'the sidebar highlights the settings route',
  args: {
    currentPath: '/settings',
  },
}

export const DesktopWindowControls: Story = {
  name: 'the sidebar reserves space for the desktop window controls',
  args: {
    currentPath: '/',
    desktopWindowControls: true,
  },
}

export const WithTags: Story = {
  name: 'the sidebar lists labels used by tasks',
  args: {
    currentPath: '/',
    tagCounts: tagCountsWithTags,
    labels: labelsForTasksWithTags,
  },
}

export const WithNestedTags: Story = {
  name: 'the sidebar nests labels into a hierarchy',
  args: {
    currentPath: '/',
    tagCounts: tagCountsWithNestedTags,
    labels: labelsForNestedTags,
  },
}

export const WithInboxTasks: Story = {
  name: 'the sidebar shows the inbox task count',
  args: {
    currentPath: '/',
    inboxCount: 1,
  },
}

export const WithProjects: Story = {
  name: 'the sidebar lists projects with different statuses',
  args: {
    currentPath: '/',
    projects: projectsAcrossStatuses,
  },
}

const fewSavedViews: SavedView[] = [
  makeSavedView({ id: '1', name: 'Now', query: 'commitment:active' }),
  makeSavedView({ id: '2', name: 'Someday', query: 'commitment:someday' }),
]

const manySavedViews: SavedView[] = Array.from({ length: 7 }, (_, i) =>
  makeSavedView({
    id: String(i + 1),
    name: `View ${String(i + 1)}`,
    query: `commitment:active label:view-${String(i + 1)}`,
  }),
)

export const WithViews: Story = {
  name: 'the sidebar lists saved task views',
  args: {
    currentPath: '/',
    savedViews: fewSavedViews,
  },
}

export const WithActiveView: Story = {
  name: 'the sidebar highlights the saved view matching the current query',
  args: {
    currentPath: '/tasks?q=commitment:active',
    savedViews: fewSavedViews,
  },
}

export const WithManyViews: Story = {
  name: 'the sidebar scrolls through a long list of saved views',
  args: {
    currentPath: '/',
    savedViews: manySavedViews,
  },
}
