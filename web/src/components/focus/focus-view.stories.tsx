import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { fn } from 'storybook/test'

import { FocusViewPresentation } from '#components/focus/focus-view'
import type { Task } from '#hooks/use-tasks'
import { StoryRouter } from '#storybook-config/story-router'

const baseTask: Task = {
  id: '00000000-0000-0000-0000-000000000001',
  number: 1,
  title: 'Design the onboarding flow',
  description: null,
  status: 'todo',
  context: 'work',
  commitment: 'active',
  labels: [],
  startDate: null,
  dueDate: null,
  estimatedMinutes: 60,
  parentId: null,
  parentNumber: null,
  projectId: null,
  recurrenceRuleId: null,
  githubLinks: [],
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
  childCompletionCount: { completed: 0, total: 0 },
}

const nextTask: Task = {
  ...baseTask,
  id: '00000000-0000-0000-0000-000000000002',
  title: 'Review pull request #42',
  estimatedMinutes: 30,
}

const completedTask: Task = {
  ...baseTask,
  id: '00000000-0000-0000-0000-000000000003',
  title: 'Write project brief',
  status: 'completed',
  estimatedMinutes: 45,
}

const subtasks: Task[] = [
  {
    ...baseTask,
    id: '00000000-0000-0000-0000-000000000011',
    title: 'Sketch wireframes',
    status: 'completed',
    parentId: baseTask.id,
    estimatedMinutes: null,
  },
  {
    ...baseTask,
    id: '00000000-0000-0000-0000-000000000012',
    title: 'Get feedback from the team',
    parentId: baseTask.id,
    estimatedMinutes: null,
  },
]

function Providers({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <StoryRouter
        component={() => <>{children}</>}
        paths={['/tasks/$taskId']}
      />
    </QueryClientProvider>
  )
}

function FocusViewWithProviders(
  props: React.ComponentProps<typeof FocusViewPresentation>,
) {
  return (
    <Providers>
      <div style={{ height: '100vh' }}>
        <FocusViewPresentation {...props} />
      </div>
    </Providers>
  )
}

const meta = {
  title: 'Page/FocusView',
  component: FocusViewWithProviders,
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    onDefer: fn(),
  },
} satisfies Meta<typeof FocusViewWithProviders>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    isLoading: false,
    queueTasks: [completedTask, baseTask, nextTask],
    focusTask: baseTask,
    nextTask,
    subtasks,
  },
}

export const InProgress: Story = {
  args: {
    isLoading: false,
    queueTasks: [completedTask, baseTask, nextTask],
    focusTask: {
      ...baseTask,
      status: 'in_progress',
    },
    nextTask,
    subtasks,
  },
}

export const NoSubtasksOrNextTask: Story = {
  args: {
    isLoading: false,
    queueTasks: [baseTask],
    focusTask: baseTask,
    nextTask: null,
    subtasks: [],
  },
}

export const Loading: Story = {
  args: {
    isLoading: true,
    queueTasks: [],
    focusTask: null,
    nextTask: null,
    subtasks: [],
  },
}

export const EmptyQueue: Story = {
  args: {
    isLoading: false,
    queueTasks: [],
    focusTask: null,
    nextTask: null,
    subtasks: [],
  },
}

export const AllDone: Story = {
  args: {
    isLoading: false,
    queueTasks: [completedTask, { ...baseTask, status: 'completed' }],
    focusTask: null,
    nextTask: null,
    subtasks: [],
  },
}
