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

import { TaskMentionChip } from '#components/task/task-mention-chip'
import { taskMentionKeys } from '#hooks/use-task-mentions'
import type { TaskDetail } from '#hooks/use-tasks'

const baseTask: TaskDetail = {
  id: '00000000-0000-0000-0000-000000000001',
  number: 42,
  title: 'Implement task mention live preview',
  description:
    'Adds live preview chips for #123-style task mentions in the editor.',
  status: 'todo',
  context: 'dev',
  startDate: null,
  dueDate: null,
  estimatedMinutes: null,
  parentId: null,
  projectId: null,
  recurrenceRuleId: null,
  recurrenceRule: null,
  githubLink: null,
  sortOrder: 0,
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
  titleAuthor: null,
  descriptionAuthor: null,
  childCompletionCount: { completed: 0, total: 0 },
  pages: [],
  timeBlocks: [],
  links: { outgoing: [], incoming: [] },
}

function Providers({
  number,
  task,
  children,
}: {
  number: number
  task: TaskDetail | null
  children: ReactNode
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  queryClient.setQueryData(taskMentionKeys.preview(number), task)

  const rootRoute = createRootRoute({
    component: () => <>{children}</>,
  })
  const taskRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/tasks/$taskId',
    component: () => null,
  })
  rootRoute.addChildren([taskRoute])
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

function TaskMentionChipWithProviders({
  number,
  raw,
  task,
}: {
  number: number
  raw: string
  task: TaskDetail | null
}) {
  return (
    <Providers number={number} task={task}>
      <p className="text-sm">
        See <TaskMentionChip data={{ number }} raw={raw} /> for details.
      </p>
    </Providers>
  )
}

const meta = {
  title: 'Task/TaskMentionChip',
  component: TaskMentionChipWithProviders,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof TaskMentionChipWithProviders>

export default meta
type Story = StoryObj<typeof meta>

export const Todo: Story = {
  args: {
    number: baseTask.number,
    raw: `#${String(baseTask.number)}`,
    task: baseTask,
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    // The chip renders as a portal into the app's own React tree in
    // production (see plugin.tsx), so this exercises the same tree shape:
    // hovering must open the preview card and render its navigation link
    // without throwing. The popup renders via a portal, so it must be
    // queried against the document body.
    await userEvent.hover(canvas.getByText(baseTask.title))
    const body = within(canvasElement.ownerDocument.body)
    await expect(
      await body.findByText(baseTask.description ?? ''),
    ).toBeVisible()
  },
}

export const InProgress: Story = {
  args: {
    number: baseTask.number,
    raw: `#${String(baseTask.number)}`,
    task: { ...baseTask, status: 'in_progress', title: 'Review pull request' },
  },
}

export const Completed: Story = {
  args: {
    number: baseTask.number,
    raw: `#${String(baseTask.number)}`,
    task: { ...baseTask, status: 'completed', title: 'Set up CI pipeline' },
  },
}

export const LongTitle: Story = {
  args: {
    number: baseTask.number,
    raw: `#${String(baseTask.number)}`,
    task: {
      ...baseTask,
      title:
        'This is a very long task title that should be truncated inside the chip',
    },
  },
}

// The task preview hasn't resolved yet (or the mentioned number doesn't
// exist): the chip falls back to rendering the raw matched text instead of
// a card.
export const Unresolved: Story = {
  args: { number: 999, raw: '#999', task: null },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('#999')).toBeVisible()
  },
}
