import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { makeTask } from '#components/task/task-row-test-fixtures'
import { TaskTreeList } from '#components/task/task-tree-list'
import type { Task, TreeNode } from '#hooks/use-tasks'
import { buildTree } from '#lib/tree-builder'
import { StoryRouter } from '#storybook-config/story-router'

const TASK_LIST_ROUTES = ['/tasks', '/tasks/$taskId']

const baseTask: Task = makeTask({
  id: '00000000-0000-0000-0000-000000000001',
  title: 'Implement task list UI',
})

const sampleTasks: Task[] = [
  { ...baseTask, id: '1', number: 1, title: 'Design system setup' },
  {
    ...baseTask,
    id: '2',
    number: 2,
    title: 'Implement sidebar navigation',
    status: 'todo',
    estimatedMinutes: 60,
    childCompletionCount: { completed: 0, total: 1 },
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
      <div className="h-96 w-full max-w-3xl">
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
  name: 'the list shows tasks with a nested child',
  args: {
    isLoading: false,
    tasks: sampleTasks,
    sessionsByTaskId: new Map(),
  },
}

export const Loading: Story = {
  name: 'the list shows its loading state before tasks arrive',
  args: {
    isLoading: true,
    tasks: [],
    sessionsByTaskId: new Map(),
  },
}

export const Empty: Story = {
  name: 'the list has no tasks to display',
  args: {
    isLoading: false,
    tasks: [],
    sessionsByTaskId: new Map(),
  },
}

export const LoadingMore: Story = {
  name: 'the list shows a loading row while fetching more tasks',
  args: {
    isLoading: false,
    tasks: sampleTasks,
    sessionsByTaskId: new Map(),
    hasNextPage: true,
    isFetchingNextPage: true,
  },
}

// Exceeds the window viewport so the window virtualizer drops off-screen
// rows under VRT.
const manyTasks: Task[] = Array.from({ length: 60 }, (_, i) => ({
  ...baseTask,
  id: `many-${String(i)}`,
  number: i + 1,
  title: `Task ${String(i)}`,
}))

export const LongList: Story = {
  name: 'the list contains enough tasks to scroll beyond the viewport',
  args: {
    isLoading: false,
    tasks: manyTasks,
    sessionsByTaskId: new Map(),
  },
}

export const WithSecondLine: Story = {
  name: 'a task row places labels dates and a pull request below its title',
  args: {
    isLoading: false,
    tasks: [
      {
        ...baseTask,
        id: '4',
        number: 4,
        title: 'Task with a full second line',
        labels: ['dev:tq', 'chore'],
        startDate: '2026-03-25',
        // Far future so this story never flips to overdue.
        dueDate: '2099-06-15',
        githubLinks: [
          {
            id: 'link-1',
            owner: 'fohte',
            repo: 'tq',
            number: 42,
            kind: 'pull_request',
            url: 'https://github.com/fohte/tq/pull/42',
            state: 'merged',
            title: 'Fix flaky test',
            lastSyncedAt: '2026-03-20T00:00:00.000Z',
          },
        ],
      },
    ],
    sessionsByTaskId: new Map(),
  },
}

// lazyChildrenFilter mode: the task passed in has no `children` loaded yet
// (as if fetched with parentId=root), and its expand toggle is driven by
// childCompletionCount.total rather than children.length.
const lazyRootTask: Task = {
  ...baseTask,
  id: 'root-1',
  number: 10,
  title: 'Root task with lazily-fetched children',
  childCompletionCount: { completed: 0, total: 1 },
}

export const LazyChildrenCollapsed: Story = {
  name: 'a task with unloaded children appears collapsed',
  args: {
    isLoading: false,
    tasks: [lazyRootTask],
    sessionsByTaskId: new Map(),
    lazyChildrenFilter: {},
  },
}
