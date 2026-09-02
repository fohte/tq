import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { fn } from 'storybook/test'

import {
  TaskKanban,
  type TaskKanbanColumn,
} from '#components/kanban/task-kanban'
import { TaskKanbanSeeAllLink } from '#components/kanban/task-kanban-see-all-link'
import { makeTask } from '#components/task/task-row-test-fixtures'
import { StoryRouter } from '#storybook-config/story-router'

function Providers({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return (
    <QueryClientProvider client={queryClient}>
      <StoryRouter
        component={() => <>{children}</>}
        paths={['/tasks/$taskId', '/tasks']}
      />
    </QueryClientProvider>
  )
}

function TaskKanbanWithProviders(
  props: React.ComponentProps<typeof TaskKanban>,
) {
  return (
    <Providers>
      <div className="h-96 w-full max-w-4xl border border-border">
        <TaskKanban {...props} />
      </div>
    </Providers>
  )
}

const inboxTasks = [
  makeTask({ id: '1', number: 101, title: 'Reply to design review comments' }),
  makeTask({ id: '2', number: 102, title: 'Renew domain registration' }),
  makeTask({ id: '3', number: 103, title: 'Read the Q3 retro notes' }),
]

const activeTasks = [
  makeTask({
    id: '4',
    number: 90,
    title: 'Ship the release notes',
    commitment: 'active',
  }),
]

const someTasks = [
  makeTask({
    id: '5',
    number: 55,
    title: 'Learn Rust',
    commitment: 'someday',
  }),
]

const baseColumns: TaskKanbanColumn[] = [
  { id: 'inbox', title: 'Inbox', tasks: inboxTasks },
  { id: 'active', title: 'Active', tasks: activeTasks },
  { id: 'someday', title: 'Someday', tasks: someTasks },
]

const meta = {
  title: 'Kanban/TaskKanban',
  component: TaskKanbanWithProviders,
  parameters: {
    layout: 'centered',
    // Columns are an intentional horizontal scroll/snap area on mobile (see
    // task-kanban.tsx) — the next column peeking past the viewport edge is
    // the design, not a bug.
    overflowCheck: { ignoreSelectors: ['.overflow-x-auto'] },
  },
  args: {
    onDrop: fn(),
  },
} satisfies Meta<typeof TaskKanbanWithProviders>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    columns: baseColumns,
  },
}

export const Loading: Story = {
  args: {
    columns: [
      { id: 'inbox', title: 'Inbox', tasks: [], isLoading: true },
      { id: 'active', title: 'Active', tasks: [], isLoading: true },
      { id: 'someday', title: 'Someday', tasks: [], isLoading: true },
    ],
  },
}

export const Empty: Story = {
  args: {
    columns: [
      { id: 'inbox', title: 'Inbox', tasks: [] },
      { id: 'active', title: 'Active', tasks: [] },
      { id: 'someday', title: 'Someday', tasks: [] },
    ],
  },
}

export const WithFooter: Story = {
  args: {
    columns: [
      { id: 'inbox', title: 'Inbox', tasks: inboxTasks },
      {
        id: 'active',
        title: 'Active',
        tasks: activeTasks,
        showCount: false,
        footer: <TaskKanbanSeeAllLink commitment="active" />,
      },
      {
        id: 'someday',
        title: 'Someday',
        tasks: someTasks,
        showCount: false,
        footer: <TaskKanbanSeeAllLink commitment="someday" />,
      },
    ],
  },
}
