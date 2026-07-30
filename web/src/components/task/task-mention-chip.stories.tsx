import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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
  task,
  children,
}: {
  task: TaskDetail
  children: ReactNode
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  queryClient.setQueryData(taskMentionKeys.preview(task.number), task)

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

function TaskMentionChipWithProviders({ task }: { task: TaskDetail }) {
  return (
    <Providers task={task}>
      <p className="text-sm">
        See <TaskMentionChip data={{ number: task.number }} /> for details.
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
  args: { task: baseTask },
  play: async ({ canvas, canvasElement, userEvent }) => {
    // The chip is mounted into its own React root (no RouterProvider) in
    // production, so this exercises the exact same isolation the real
    // ProseMirror widget does: hovering must open the preview card and
    // render its navigation link without throwing. The popup renders via a
    // portal, so it must be queried against the document body.
    await userEvent.hover(canvas.getByText(baseTask.title))
    const body = within(canvasElement.ownerDocument.body)
    await expect(
      await body.findByText(baseTask.description ?? ''),
    ).toBeVisible()
  },
}

export const InProgress: Story = {
  args: {
    task: { ...baseTask, status: 'in_progress', title: 'Review pull request' },
  },
}

export const Completed: Story = {
  args: {
    task: { ...baseTask, status: 'completed', title: 'Set up CI pipeline' },
  },
}

export const LongTitle: Story = {
  args: {
    task: {
      ...baseTask,
      title:
        'This is a very long task title that should be truncated inside the chip',
    },
  },
}
