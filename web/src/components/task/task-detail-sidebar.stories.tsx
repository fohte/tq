import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { expect, userEvent, within } from 'storybook/test'

import { makeProjectDetail } from '#components/project/project-test-fixtures'
import { makeGithubLink } from '#components/task/github-link-test-fixtures'
import {
  TaskSidebar,
  TaskSidebarMobile,
} from '#components/task/task-detail-sidebar'
import { makeTaskDetail } from '#components/task/task-row-test-fixtures'
import { makeTimeBlock } from '#components/task/time-block-test-fixtures'
import { labelKeys } from '#hooks/use-labels'
import type { ProjectDetail } from '#hooks/use-projects'
import { projectKeys } from '#hooks/use-projects'
import { DAY_QUEUE_KEY, queueKeys } from '#hooks/use-queues'
import type { TaskDetail } from '#hooks/use-tasks'
import { taskKeys } from '#hooks/use-tasks'
import { formatLocalDate } from '#lib/date-range'
import { assertDefined } from '#lib/test-utils'
import { StoryRouter } from '#storybook-config/story-router'

const baseTask = makeTaskDetail({
  childCompletionCount: { completed: 1, total: 3 },
})

function Providers({
  children,
  task,
  project,
}: {
  children: ReactNode
  task: TaskDetail
  project?: ProjectDetail | undefined
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  // TaskSidebar/TaskSidebarMobile always mount SidebarParentField,
  // SidebarProjectField, and SidebarTagsField, which read these regardless
  // of the story's task.
  queryClient.setQueryData(taskKeys.list(undefined), [])
  queryClient.setQueryData(labelKeys.list({ context: 'personal' }), [])
  queryClient.setQueryData(
    projectKeys.list(undefined),
    project ? [project] : [],
  )
  if (project) {
    queryClient.setQueryData(projectKeys.detail(project.id), project)
  }
  // An auto-scheduled time block's row fetches that day's queue (to know
  // which task to drop on delete) — seed it so the story never hits the
  // network.
  for (const block of task.timeBlocks) {
    if (!block.isAutoScheduled) continue
    const date = formatLocalDate(new Date(block.startTime))
    queryClient.setQueryData(queueKeys.items(DAY_QUEUE_KEY, date), [
      {
        id: `queue-item-${block.id}`,
        taskId: task.id,
        periodStart: date,
        sortOrder: 0,
        createdAt: block.createdAt,
        updatedAt: block.updatedAt,
      },
    ])
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
    <Providers task={task} project={project}>
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
      githubLinks: [makeGithubLink({ title: 'Implement task detail page' })],
    },
  },
}

const sampleProject: ProjectDetail = makeProjectDetail({
  id: 'aaaa0000-0000-0000-0000-000000000000',
  completionRate: 0.4,
  taskCount: { total: 10, completed: 4 },
})

export const SidebarWithProject: Story = {
  args: {
    task: { ...baseTask, projectId: sampleProject.id },
    project: sampleProject,
  },
}

// Desktop only: at the mobile viewport the sidebar's fields already fill the
// frame, pushing TIME BLOCKS — the one thing this story adds — out of the
// screenshot and leaving it identical to Sidebar.
export const SidebarWithTimeBlocks: Story = {
  tags: ['desktop-only'],
  args: {
    task: {
      ...baseTask,
      timeBlocks: [
        makeTimeBlock({
          id: 'block-1',
          taskId: baseTask.id,
          startTime: '2026-07-30T10:00:00.000Z',
          endTime: '2026-07-30T11:30:00.000Z',
          isAutoScheduled: true,
        }),
        makeTimeBlock({
          id: 'block-2',
          taskId: baseTask.id,
          startTime: '2026-07-29T16:00:00.000Z',
          endTime: '2026-07-29T16:45:00.000Z',
          isAutoScheduled: false,
        }),
      ],
    },
  },
}

// Opens the STATUS select to exercise the "Close as" group (completed /
// not planned / duplicate), which the closed trigger alone never renders.
async function openStatusSelect(canvasElement: HTMLElement) {
  const canvas = within(canvasElement)
  const statusField = assertDefined(canvas.getByText('STATUS').closest('div'))
  const body = within(canvasElement.ownerDocument.body)

  await userEvent.click(within(statusField).getByRole('combobox'))

  return body
}

export const SidebarCompletedOpen: Story = {
  args: {
    task: { ...baseTask, status: 'completed', statusReason: 'completed' },
  },
  play: async ({ canvasElement }) => {
    const body = await openStatusSelect(canvasElement)
    await expect(
      await body.findByRole('option', { name: 'completed' }),
    ).toHaveAttribute('aria-selected', 'true')
  },
}

export const SidebarNotPlannedOpen: Story = {
  args: {
    task: { ...baseTask, status: 'completed', statusReason: 'not_planned' },
  },
  play: async ({ canvasElement }) => {
    const body = await openStatusSelect(canvasElement)
    await expect(
      await body.findByRole('option', { name: 'not planned' }),
    ).toHaveAttribute('aria-selected', 'true')
  },
}

export const SidebarDuplicateOpen: Story = {
  args: {
    task: { ...baseTask, status: 'completed', statusReason: 'duplicate' },
  },
  play: async ({ canvasElement }) => {
    const body = await openStatusSelect(canvasElement)
    await expect(
      await body.findByRole('option', { name: 'duplicate' }),
    ).toHaveAttribute('aria-selected', 'true')
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
    <Providers task={task} project={project}>
      <div className="max-w-sm border-t border-border p-4">
        <TaskSidebarMobile task={task} />
      </div>
    </Providers>
  ),
}
