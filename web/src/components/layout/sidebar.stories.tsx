import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, userEvent, within } from 'storybook/test'

import { Sidebar } from '#components/layout/sidebar'
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
import { assertDefined } from '#lib/test-utils'
import { StoryRouter } from '#storybook-config/story-router'

const tasksWithTags: Task[] = [
  makeTask({ id: '1', title: 'Task A', labels: ['dev:tq', 'urgent'] }),
  makeTask({ id: '2', title: 'Task B', labels: ['dev:tq'] }),
  makeTask({ id: '3', title: 'Task C', labels: ['review'] }),
]

const labelsForTasksWithTags = [
  makeLabel({ id: '1', name: 'dev:tq' }),
  makeLabel({ id: '2', name: 'urgent' }),
  makeLabel({ id: '3', name: 'review' }),
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
  savedViews,
  labels,
}: {
  tasks?: Task[] | undefined
  projects?: Project[] | undefined
  savedViews?: SavedView[] | undefined
  labels?: Label[] | undefined
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  queryClient.setQueryData(taskKeys.list(undefined), tasks ?? [])
  queryClient.setQueryData(
    projectKeys.list({ context: 'personal' }),
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
        <Sidebar />
      </div>
    </QueryClientProvider>
  )
}

function SidebarWithRouter({
  currentPath,
  tasks,
  projects,
  savedViews,
  labels,
}: {
  currentPath: string
  tasks?: Task[] | undefined
  projects?: Project[] | undefined
  savedViews?: SavedView[] | undefined
  labels?: Label[] | undefined
}) {
  return (
    <StoryRouter
      component={() => (
        <SidebarStory
          tasks={tasks}
          projects={projects}
          savedViews={savedViews}
          labels={labels}
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
    labels: labelsForTasksWithTags,
  },
}

export const WithProjects: Story = {
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
  args: {
    currentPath: '/',
    savedViews: fewSavedViews,
  },
}

export const WithActiveView: Story = {
  args: {
    currentPath: '/tasks?q=commitment:active',
    savedViews: fewSavedViews,
  },
}

export const WithManyViews: Story = {
  args: {
    currentPath: '/',
    savedViews: manySavedViews,
  },
}

export const ViewActionsMenuOpen: Story = {
  args: {
    currentPath: '/',
    savedViews: fewSavedViews,
  },
  tags: ['desktop-only'],
  play: async ({ canvasElement }) => {
    const trigger = assertDefined(
      canvasElement.querySelector<HTMLElement>(
        '[data-slot="dropdown-menu-trigger"]',
      ),
      'desktop trigger not found',
    )
    await userEvent.click(trigger)

    const body = within(canvasElement.ownerDocument.body)
    await expect(await body.findByText('rename…')).toBeInTheDocument()
    await expect(body.getByText('delete…')).toBeInTheDocument()
  },
}
