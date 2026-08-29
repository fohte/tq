import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { StatusLine } from '#components/layout/status-line'
import type { Task } from '#hooks/use-tasks'
import { taskKeys } from '#hooks/use-tasks'
import type { TodayTask } from '#hooks/use-today-tasks'
import { formatLocalDate } from '#lib/date-range'
import { StoryRouter } from '#storybook-config/story-router'

const todayStr = formatLocalDate(new Date())

const baseTask: Task = {
  id: '00000000-0000-0000-0000-000000000001',
  number: 1,
  title: 'Implement task list UI',
  description: null,
  status: 'todo',
  context: 'personal',
  labels: [],
  startDate: null,
  dueDate: null,
  estimatedMinutes: 30,
  parentId: null,
  parentNumber: null,
  projectId: null,
  recurrenceRuleId: null,
  githubLinks: [],
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
  childCompletionCount: { completed: 0, total: 0 },
}

const tasks: Task[] = [
  { ...baseTask, id: '1', title: 'Task A', estimatedMinutes: 30 },
  { ...baseTask, id: '2', title: 'Task B', estimatedMinutes: 60 },
  {
    ...baseTask,
    id: '3',
    title: 'Task C',
    status: 'completed',
    estimatedMinutes: 45,
  },
]

const queueTasks: TodayTask[] = tasks.map((task, index) => ({
  id: `queue-${task.id}`,
  taskId: task.id,
  date: todayStr,
  sortOrder: index,
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
}))

function StatusLineStory() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  // StatusLine's useFilteredTaskList() builds an empty (not undefined)
  // filter object when no context/tag filter is active.
  queryClient.setQueryData(taskKeys.list({}), tasks)
  queryClient.setQueryData(['today-tasks', 'list', todayStr], queueTasks)

  return (
    <QueryClientProvider client={queryClient}>
      <StatusLine />
    </QueryClientProvider>
  )
}

function StatusLineWithRouter({ currentPath }: { currentPath: string }) {
  return <StoryRouter component={StatusLineStory} initialPath={currentPath} />
}

const meta = {
  title: 'Layout/StatusLine',
  component: StatusLineWithRouter,
  tags: ['desktop-only'],
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    currentPath: {
      control: 'select',
      options: ['/', '/tasks', '/today', '/projects'],
    },
  },
} satisfies Meta<typeof StatusLineWithRouter>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    currentPath: '/',
  },
}

export const TasksPath: Story = {
  args: {
    currentPath: '/tasks',
  },
}
