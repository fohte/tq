import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FocusViewPresentation } from '@web/components/focus/focus-view'
import type { Task } from '@web/hooks/use-tasks'
import type { ReactNode } from 'react'

const baseTask: Task = {
  id: '00000000-0000-0000-0000-000000000001',
  title: 'Design the onboarding flow',
  description: null,
  status: 'todo',
  context: 'work',
  startDate: null,
  dueDate: null,
  estimatedMinutes: 60,
  parentId: null,
  projectId: null,
  sortOrder: 0,
  recurrenceRuleId: null,
  recurrenceRule: null,
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
  activeTimeBlockStartTime: null,
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
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
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
      activeTimeBlockStartTime: new Date(
        Date.now() - 12 * 60 * 1000,
      ).toISOString(),
    },
    nextTask,
    subtasks,
  },
}

export const OverEstimate: Story = {
  args: {
    isLoading: false,
    queueTasks: [{ ...baseTask, status: 'in_progress', estimatedMinutes: 10 }],
    focusTask: {
      ...baseTask,
      status: 'in_progress',
      estimatedMinutes: 10,
      activeTimeBlockStartTime: new Date(
        Date.now() - 25 * 60 * 1000,
      ).toISOString(),
    },
    nextTask: null,
    subtasks: [],
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
