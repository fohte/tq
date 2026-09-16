import type { DraggableAttributes } from '@dnd-kit/core'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'
import { fn } from 'storybook/test'

import { QueueItemRowAppearance } from '#components/task/queue-item-row'
import { makeTask as makeBaseTask } from '#components/task/task-row-test-fixtures'
import type { Task } from '#hooks/use-tasks'
import { MemoizedStoryRouter } from '#storybook-config/story-router'

function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false } },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <MemoizedStoryRouter paths={['/tasks/$taskId']}>
        {children}
      </MemoizedStoryRouter>
    </QueryClientProvider>
  )
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return makeBaseTask({
    id: '00000000-0000-0000-0000-000000000001',
    title: 'Write the quarterly report',
    context: 'work',
    estimatedMinutes: 30,
    ...overrides,
  })
}

// Matches what useSortable produces outside an active drag; there's no real
// DndContext driving a drag in these stories, so these are static stand-ins
// for the plumbing QueueItemRow would otherwise compute and forward.
const stubDndProps = {
  attributes: {
    role: 'button',
    tabIndex: 0,
    'aria-disabled': false,
    'aria-pressed': undefined,
    'aria-roledescription': 'sortable',
    'aria-describedby': 'stub',
  } satisfies DraggableAttributes,
  listeners: undefined,
  setNodeRef: () => {},
  style: {},
}

const meta = {
  title: 'Task/QueueItemRow',
  component: QueueItemRowAppearance,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <Providers>
        <div className="w-full max-w-96">
          <Story />
        </div>
      </Providers>
    ),
  ],
  args: {
    ...stubDndProps,
    onRemove: fn(),
    isEditingEstimate: false,
    estimateInput: '',
    onEstimateInputChange: fn(),
    onStartEditingEstimate: fn(),
    onCommitEstimate: fn(),
    onCancelEstimate: fn(),
  },
} satisfies Meta<typeof QueueItemRowAppearance>

export default meta
type Story = StoryObj<typeof meta>

export const WithEstimate: Story = {
  args: {
    task: makeTask(),
  },
}

export const MissingEstimate: Story = {
  args: {
    task: makeTask({ estimatedMinutes: null, title: 'Plan the launch' }),
  },
}

export const EditingEstimate: Story = {
  args: {
    task: makeTask({ estimatedMinutes: null, title: 'Plan the launch' }),
    isEditingEstimate: true,
  },
}

export const Completed: Story = {
  args: {
    task: makeTask({ status: 'completed', title: 'Ship the release notes' }),
  },
}
