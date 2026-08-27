import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { TaskTreeList } from '#components/task/task-tree-list'
import type { Task, TreeNode } from '#hooks/use-tasks'
import { buildTree } from '#lib/tree-builder'
import { StoryRouter } from '#storybook-config/story-router'

const TASK_LIST_ROUTES = ['/tasks', '/tasks/$taskId']

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
  estimatedMinutes: null,
  parentId: null,
  parentNumber: null,
  projectId: null,
  recurrenceRuleId: null,
  githubLink: null,
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
  childCompletionCount: { completed: 0, total: 0 },
}

const sampleTasks: Task[] = [
  { ...baseTask, id: '1', number: 1, title: 'Design system setup' },
  {
    ...baseTask,
    id: '2',
    number: 2,
    title: 'Implement sidebar navigation',
    status: 'in_progress',
    estimatedMinutes: 60,
  },
  {
    ...baseTask,
    id: '3',
    number: 3,
    title: 'Sub-task of sidebar navigation',
    parentId: '2',
    parentNumber: 2,
    estimatedMinutes: 30,
  },
]

function Providers({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return (
    <QueryClientProvider client={queryClient}>
      <StoryRouter component={() => <>{children}</>} paths={TASK_LIST_ROUTES} />
    </QueryClientProvider>
  )
}

function WrappedTaskTreeList({
  tasks,
  ...props
}: { tasks: Task[] } & Omit<
  React.ComponentProps<typeof TaskTreeList>,
  'tree' | 'tasks'
>) {
  const tree: TreeNode[] = buildTree(tasks)

  return (
    <Providers>
      <div className="h-96 w-3xl">
        <TaskTreeList {...props} tree={tree} tasks={tasks} />
      </div>
    </Providers>
  )
}

const meta = {
  title: 'Task/TaskTreeList',
  component: WrappedTaskTreeList,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof WrappedTaskTreeList>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    isLoading: false,
    tasks: sampleTasks,
    sessionsByTaskId: new Map(),
  },
}

export const Loading: Story = {
  args: {
    isLoading: true,
    tasks: [],
    sessionsByTaskId: new Map(),
  },
}

export const Empty: Story = {
  args: {
    isLoading: false,
    tasks: [],
    sessionsByTaskId: new Map(),
  },
}
