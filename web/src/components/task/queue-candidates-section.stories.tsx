import { DndContext } from '@dnd-kit/core'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'
import { fn } from 'storybook/test'

import { QueueCandidatesSection } from '#components/task/queue-candidates-section'
import type { Task } from '#hooks/use-tasks'
import type { QueueCandidate } from '#lib/queue-candidates'
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
  return {
    id: '00000000-0000-0000-0000-000000000001',
    number: 1,
    title: 'Untitled task',
    description: null,
    status: 'todo',
    context: 'personal',
    startDate: null,
    dueDate: null,
    estimatedMinutes: null,
    labels: [],
    parentId: null,
    parentNumber: null,
    projectId: null,
    recurrenceRuleId: null,
    githubLink: null,
    createdAt: '2026-03-20T00:00:00.000Z',
    updatedAt: '2026-03-20T00:00:00.000Z',
    childCompletionCount: { completed: 0, total: 0 },
    ...overrides,
  }
}

const meta = {
  title: 'Task/QueueCandidatesSection',
  component: QueueCandidatesSection,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <Providers>
        <div className="w-96 border border-border">
          <DndContext>
            <Story />
          </DndContext>
        </div>
      </Providers>
    ),
  ],
  args: {
    onAdd: fn(),
  },
} satisfies Meta<typeof QueueCandidatesSection>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  args: {
    candidates: [],
  },
}

export const OverdueOnly: Story = {
  args: {
    candidates: [
      {
        task: makeTask({
          id: '1',
          title: 'Renew SSL certificate',
          dueDate: '2026-03-10',
        }),
        reason: { kind: 'overdue', days: 10 },
      },
      {
        task: makeTask({
          id: '2',
          title: 'Follow up on invoice',
          dueDate: '2026-03-17',
        }),
        reason: { kind: 'overdue', days: 3 },
      },
    ] satisfies QueueCandidate<Task>[],
  },
}

export const MixedReasons: Story = {
  args: {
    candidates: [
      {
        task: makeTask({
          id: '1',
          title: 'Renew SSL certificate',
          dueDate: '2026-03-17',
        }),
        reason: { kind: 'overdue', days: 3 },
      },
      {
        task: makeTask({
          id: '2',
          title: 'Follow up on invoice',
          dueDate: '2026-03-19',
        }),
        reason: { kind: 'overdue', days: 1 },
      },
      {
        task: makeTask({
          id: '3',
          title: 'Submit expense report',
          dueDate: '2026-03-20',
        }),
        reason: { kind: 'due-today' },
      },
      {
        task: makeTask({
          id: '4',
          title: 'Plan the launch',
          startDate: '2026-03-20',
        }),
        reason: { kind: 'starts', days: 0 },
      },
    ] satisfies QueueCandidate<Task>[],
  },
}
