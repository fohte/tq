import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { expect, within } from 'storybook/test'

import type { InheritedTaskAttributes } from '#components/task/create-task-inline'
import { TaskSubtasksList } from '#components/task/task-subtasks-section'
import type { ProjectDetail } from '#hooks/use-projects'
import { projectKeys } from '#hooks/use-projects'
import type { Task } from '#hooks/use-tasks'

const parentTaskId = '00000000-0000-0000-0000-000000000001'

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
  taskCount: { total: 10, completed: 4 },
}

const baseSubtask: Task = {
  id: '00000000-0000-0000-0000-000000000011',
  number: 11,
  title: 'Sketch wireframes',
  description: null,
  status: 'todo',
  context: 'work',
  labels: [],
  startDate: null,
  dueDate: null,
  estimatedMinutes: 30,
  parentId: parentTaskId,
  parentNumber: 1,
  projectId: null,
  sortOrder: 0,
  recurrenceRuleId: null,
  recurrenceRule: null,
  githubLink: null,
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
}

const mixedSubtasks: Task[] = [
  {
    ...baseSubtask,
    id: '00000000-0000-0000-0000-000000000011',
    number: 11,
    title: 'Sketch wireframes',
    status: 'completed',
    estimatedMinutes: 30,
  },
  {
    ...baseSubtask,
    id: '00000000-0000-0000-0000-000000000012',
    number: 12,
    title: 'Get feedback from the team',
    status: 'in_progress',
    estimatedMinutes: 15,
  },
  {
    ...baseSubtask,
    id: '00000000-0000-0000-0000-000000000013',
    number: 13,
    title: 'Finalize the design',
    status: 'todo',
    estimatedMinutes: null,
  },
]

const allCompletedSubtasks: Task[] = mixedSubtasks.map((subtask) => ({
  ...subtask,
  status: 'completed',
}))

function Providers({
  children,
  project,
}: {
  children: ReactNode
  project?: ProjectDetail | undefined
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  if (project) {
    queryClient.setQueryData(projectKeys.detail(project.id), project)
  }
  const rootRoute = createRootRoute({
    component: () => <>{children}</>,
  })
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => null,
  })
  const taskRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/tasks/$taskId',
    component: () => null,
  })
  rootRoute.addChildren([indexRoute, taskRoute])

  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

function SectionStory({
  subtasks,
  inherited,
  project,
}: {
  subtasks: Task[]
  inherited: InheritedTaskAttributes
  project?: ProjectDetail | undefined
}) {
  return (
    <Providers project={project}>
      <div className="max-w-2xl p-6">
        <TaskSubtasksList
          taskId={parentTaskId}
          parentTaskNumber={1}
          subtasks={subtasks}
          inherited={inherited}
        />
      </div>
    </Providers>
  )
}

const meta = {
  title: 'Task/Subtasks/Section',
  component: SectionStory,
  parameters: {
    layout: 'padded',
  },
  args: {
    inherited: { context: 'work', projectId: null, labels: [] },
  },
} satisfies Meta<typeof SectionStory>

export default meta
type SectionStoryType = StoryObj<typeof meta>

export const Default: SectionStoryType = {
  args: { subtasks: mixedSubtasks },
}

export const AllCompleted: SectionStoryType = {
  args: { subtasks: allCompletedSubtasks },
}

export const Empty: SectionStoryType = {
  args: { subtasks: [] },
}

export const AddingSubtask: SectionStoryType = {
  args: {
    subtasks: mixedSubtasks,
    inherited: {
      context: 'work',
      projectId: sampleProject.id,
      labels: ['dev:tq'],
    },
    project: sampleProject,
  },
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement)

    const addButton = await canvas.findByRole('button', {
      name: /add subtask/i,
    })
    await userEvent.click(addButton)

    const input = await canvas.findByPlaceholderText(/New task/i)

    // Inherited context/labels/project show as dim preview chips before typing.
    await expect(canvas.getByText('work')).toBeInTheDocument()
    await expect(canvas.getByText(/dev:tq/)).toBeInTheDocument()
    await expect(canvas.getByText(/project: tq/)).toBeInTheDocument()

    // Typed notation overrides the inherited context.
    await userEvent.type(input, '%personal ')
    await expect(canvas.getByText('personal')).toBeInTheDocument()
    await expect(canvas.queryByText('work')).not.toBeInTheDocument()

    // Escape closes the row back to the trigger button.
    await userEvent.keyboard('{Escape}')
    await expect(
      canvas.queryByPlaceholderText(/New task/i),
    ).not.toBeInTheDocument()
    await expect(
      canvas.getByRole('button', { name: /add subtask/i }),
    ).toBeInTheDocument()
  },
}
