import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import {
  TaskSidebar,
  TaskSidebarMobile,
} from '#components/task/task-detail-sidebar'
import { labelKeys } from '#hooks/use-labels'
import type { ProjectDetail } from '#hooks/use-projects'
import { projectKeys } from '#hooks/use-projects'
import type { TaskDetail } from '#hooks/use-tasks'
import { taskKeys } from '#hooks/use-tasks'
import { StoryRouter } from '#storybook-config/story-router'

const baseTask: TaskDetail = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  number: 1,
  title: 'Implement task detail page',
  description:
    '## Why\n\nThe task detail page is needed.\n\n## What\n\n- Add inline editing\n- Add sidebar fields',
  status: 'todo',
  context: 'personal',
  commitment: 'active',
  labels: [],
  startDate: '2026-03-20',
  dueDate: '2026-03-25',
  estimatedMinutes: 90,
  parentId: null,
  projectId: null,
  recurrenceRuleId: null,
  recurrenceRule: null,
  githubLinks: [],
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
  titleAuthor: null,
  descriptionAuthor: null,
  childCompletionCount: { completed: 1, total: 3 },
  pages: [],
  timeBlocks: [],
  links: { outgoing: [], incoming: [] },
}

function Providers({
  children,
  project,
}: {
  children: ReactNode
  project?: ProjectDetail | undefined
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  // TaskSidebar/TaskSidebarMobile always mount SidebarParentField,
  // SidebarProjectField, and SidebarTagsField, which read these regardless
  // of the story's task.
  queryClient.setQueryData(taskKeys.list(undefined), [])
  queryClient.setQueryData(labelKeys.all, [])
  queryClient.setQueryData(
    projectKeys.list(undefined),
    project ? [project] : [],
  )
  if (project) {
    queryClient.setQueryData(projectKeys.detail(project.id), project)
  }

  return (
    <QueryClientProvider client={queryClient}>
      <StoryRouter
        component={() => <>{children}</>}
        paths={['/tasks', '/tasks/$taskId', '/projects/$projectId']}
      />
    </QueryClientProvider>
  )
}

function SidebarStory({
  task,
  project,
}: {
  task: TaskDetail
  project?: ProjectDetail | undefined
}) {
  return (
    <Providers project={project}>
      <TaskSidebar task={task} />
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
      githubLinks: [
        {
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
      ],
    },
  },
}

const sampleProject: ProjectDetail = {
  id: 'aaaa0000-0000-0000-0000-000000000000',
  title: 'tq',
  description: null,
  status: 'active',
  startDate: null,
  targetDate: null,
  color: null,
  sortOrder: 0,
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
  completionRate: 0.4,
  taskCount: { total: 10, todo: 4, inProgress: 2, completed: 4 },
}

export const SidebarWithProject: Story = {
  args: {
    task: { ...baseTask, projectId: sampleProject.id },
    project: sampleProject,
  },
}

export const SidebarWithTimeBlocks: Story = {
  args: {
    task: {
      ...baseTask,
      timeBlocks: [
        {
          id: 'block-1',
          taskId: baseTask.id,
          startTime: '2026-07-30T10:00:00.000Z',
          endTime: '2026-07-30T11:30:00.000Z',
          isAutoScheduled: true,
          createdAt: '2026-07-30T09:00:00.000Z',
          updatedAt: '2026-07-30T09:00:00.000Z',
        },
        {
          id: 'block-2',
          taskId: baseTask.id,
          startTime: '2026-07-29T16:00:00.000Z',
          endTime: '2026-07-29T16:45:00.000Z',
          isAutoScheduled: false,
          createdAt: '2026-07-29T15:00:00.000Z',
          updatedAt: '2026-07-29T15:00:00.000Z',
        },
      ],
    },
  },
}

export const MobileSidebar: StoryObj<{
  task: TaskDetail
  project?: ProjectDetail | undefined
}> = {
  args: {
    task: { ...baseTask },
  },
  render: ({ task, project }) => (
    <Providers project={project}>
      <div className="max-w-sm border-t border-border p-4">
        <TaskSidebarMobile task={task} />
      </div>
    </Providers>
  ),
}
