import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { expect, within } from 'storybook/test'

import { TaskTreeList } from '#components/task/task-tree-list'
import type { Task, TreeNode } from '#hooks/use-tasks'
import { emptyLabelsHandler, emptyTasksHandler } from '#lib/msw-test-handlers'
import { assertDefined, findVisible } from '#lib/test-utils'
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
  commitment: 'active',
  labels: [],
  startDate: null,
  dueDate: null,
  estimatedMinutes: null,
  parentId: null,
  parentNumber: null,
  projectId: null,
  recurrenceRuleId: null,
  githubLinks: [],
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

export const LoadingMore: Story = {
  args: {
    isLoading: false,
    tasks: sampleTasks,
    sessionsByTaskId: new Map(),
    hasNextPage: true,
    isFetchingNextPage: true,
  },
}

export const WithSecondLine: Story = {
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

// The outliner input's position among sibling rows is decided by
// TaskTreeList's flattened render list (buildTreeRenderRows), not by
// TreeTaskGridRow itself, so this composed placement only has coverage here.
export const AddSubtaskInputOpen: Story = {
  args: {
    isLoading: false,
    tasks: [
      {
        ...baseTask,
        id: '5',
        number: 5,
        title: 'Parent with an open add-subtask row',
      },
    ],
    sessionsByTaskId: new Map(),
  },
  parameters: {
    // The opened row renders CreateTaskInline (via TreeOutlinerInputRow),
    // which fetches labels on mount, plus the full task list since this
    // 'child'-mode input has a non-null parentId (see NestedChild in
    // tree-outliner-input-row.stories.tsx).
    msw: {
      handlers: [emptyLabelsHandler, emptyTasksHandler],
    },
  },
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement)
    // Both menu widgets render their open content via a portal to
    // document.body (see task-status-picker.stories.tsx), so queries for
    // their items must be scoped to the body, not canvasElement.
    const body = within(canvasElement.ownerDocument.body)
    // The dropdown trigger (desktop) and action-sheet trigger (mobile) are
    // both always in the DOM, split by a `hidden md:flex` / `flex md:hidden`
    // pair — only one is actually visible for a given project's viewport
    // (see the Hovered story in tree-task-grid-row.stories.tsx), and each
    // opens a different widget with a different item role.
    const dropdownTrigger = findVisible(
      Array.from(
        canvasElement.querySelectorAll<HTMLElement>(
          '[data-slot="dropdown-menu-trigger"][aria-label="Task actions"]',
        ),
      ),
    )
    const actionSheetTrigger = findVisible(
      Array.from(
        canvasElement.querySelectorAll<HTMLElement>(
          '[data-slot="action-sheet-trigger"][aria-label="Task actions"]',
        ),
      ),
    )

    if (actionSheetTrigger) {
      await userEvent.click(actionSheetTrigger)
      await userEvent.click(
        await body.findByRole('button', { name: /add subtask/i }),
      )
    } else {
      await userEvent.click(
        assertDefined(dropdownTrigger, 'row-actions trigger not found'),
      )
      await userEvent.click(
        await body.findByRole('menuitem', { name: /add subtask/i }),
      )
    }

    await expect(
      await canvas.findByPlaceholderText(/New task/i),
    ).toBeInTheDocument()
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
  args: {
    isLoading: false,
    tasks: [lazyRootTask],
    sessionsByTaskId: new Map(),
    lazyChildrenFilter: {},
  },
}

export const LazyChildrenExpanded: Story = {
  args: {
    isLoading: false,
    tasks: [lazyRootTask],
    sessionsByTaskId: new Map(),
    lazyChildrenFilter: {},
  },
  parameters: {
    msw: {
      handlers: [
        http.get('/api/tasks', ({ request }) => {
          const parentId = new URL(request.url).searchParams.get('parentId')
          return HttpResponse.json(
            parentId === 'root-1'
              ? [
                  {
                    ...baseTask,
                    id: 'child-1',
                    number: 11,
                    title: 'Lazily fetched child',
                    parentId: 'root-1',
                    parentNumber: 10,
                  },
                ]
              : [],
          )
        }),
      ],
    },
  },
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole('button', { name: 'Expand' }))

    await expect(
      await canvas.findByText('Lazily fetched child'),
    ).toBeInTheDocument()
  },
}
