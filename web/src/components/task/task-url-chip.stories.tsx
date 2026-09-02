import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { expect, waitFor, within } from 'storybook/test'

import { makeTaskDetail } from '#components/task/task-row-test-fixtures'
import { TaskUrlChip } from '#components/task/task-url-chip'
import type { TaskUrlPreview } from '#hooks/use-task-url-preview'
import { taskUrlPreviewKeys } from '#hooks/use-task-url-preview'
import { StoryRouter } from '#storybook-config/story-router'

const TASK_ID = '42'
const TASK_URL = 'https://tq.fohte.net/tasks/42'
const UNRESOLVED_ID = '999'
const UNRESOLVED_URL = 'https://tq.fohte.net/tasks/999'

const baseTask: TaskUrlPreview = makeTaskDetail({
  id: '00000000-0000-0000-0000-000000000001',
  number: 42,
  title: 'Implement task URL live preview',
  description: 'Adds live preview chips for pasted tq task URLs.',
  startDate: null,
  dueDate: null,
  estimatedMinutes: null,
})

function Providers({
  id,
  task,
  children,
}: {
  id: string
  task: TaskUrlPreview | null
  children: ReactNode
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  queryClient.setQueryData(taskUrlPreviewKeys.preview(id), task)

  return (
    <QueryClientProvider client={queryClient}>
      <StoryRouter
        component={() => <>{children}</>}
        paths={['/tasks/$taskId']}
      />
    </QueryClientProvider>
  )
}

function TaskUrlChipWithProviders({
  id,
  raw,
  task,
}: {
  id: string
  raw: string
  task: TaskUrlPreview | null
}) {
  return (
    <Providers id={id} task={task}>
      <p className="text-sm">
        See <TaskUrlChip data={{ id }} raw={raw} /> for details.
      </p>
    </Providers>
  )
}

const meta = {
  title: 'Task/TaskUrlChip',
  component: TaskUrlChipWithProviders,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof TaskUrlChipWithProviders>

export default meta
type Story = StoryObj<typeof meta>

export const Todo: Story = {
  args: { id: TASK_ID, raw: TASK_URL, task: baseTask },
  play: async ({ canvas, canvasElement, userEvent }) => {
    // The chip renders as a portal into the app's own React tree in
    // production (see plugin.tsx), so this exercises the same tree shape:
    // hovering must open the preview card and render its navigation link
    // without throwing. The popup renders via a portal, so it must be
    // queried against the document body.
    await userEvent.hover(canvas.getByText(baseTask.title))
    const body = within(canvasElement.ownerDocument.body)
    // The popup's fade-in animation can still be mid-transition right as the
    // text mounts, so wait for it to finish rather than checking visibility
    // the instant the text appears.
    await waitFor(() =>
      expect(body.getByText(baseTask.description ?? '')).toBeVisible(),
    )
  },
}

export const Completed: Story = {
  args: {
    id: TASK_ID,
    raw: TASK_URL,
    task: { ...baseTask, status: 'completed', title: 'Set up CI pipeline' },
  },
}

// The task preview hasn't resolved yet (or the id doesn't point at an
// actual task): the chip falls back to rendering the raw matched text
// instead of a card.
export const Unresolved: Story = {
  args: { id: UNRESOLVED_ID, raw: UNRESOLVED_URL, task: null },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(UNRESOLVED_URL)).toBeVisible()
  },
}
