import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { makePrioritySettings } from '#components/task/priority-settings-test-fixtures'
import { makeTask } from '#components/task/task-row-test-fixtures'
import type { Task, TaskListFilter } from '#hooks/use-tasks'
import { Route as InboxRoute } from '#routes/inbox'

const priorityOrder = [-1, null, 0, 2, 1] as const
const settings = makePrioritySettings().map((setting) => ({
  ...setting,
  sortOrder: priorityOrder.findIndex(
    (priority) => priority === setting.priority,
  ),
}))
const deferredTask = makeTask({
  id: 'deferred-task',
  title: 'Move to inbox',
  priority: -1,
})

const mocks = vi.hoisted(() => ({
  fetchTaskList: vi.fn<(filter: TaskListFilter<'row'>) => Promise<Task[]>>(),
  useTaskList: vi.fn<
    () => {
      categorized: { all: Task[] }
      isLoading: boolean
      isError: boolean
    }
  >(),
  mutate: vi.fn(),
}))

vi.mock('#hooks/use-tasks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#hooks/use-tasks')>()
  return {
    ...actual,
    fetchTaskList: mocks.fetchTaskList,
    useTaskList: () => mocks.useTaskList(),
    useUpdateTask: () => ({ mutate: mocks.mutate }),
  }
})

vi.mock('#hooks/use-priority-settings', () => ({
  usePrioritySettings: () => ({ data: settings }),
}))

vi.mock('#hooks/use-current-context', () => ({
  useCurrentContext: () => 'work',
}))

// File routes are normally wired by routeTree.gen.ts; reproduce the runtime
// parent and ID so the test exercises the real Inbox route component.
const rootRoute = createRootRoute()
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-type-assertion -- mirrors routeTree.gen.ts when wiring file routes
InboxRoute.update({
  id: '/inbox',
  path: '/inbox',
  getParentRoute: () => rootRoute,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mirrors routeTree.gen.ts when wiring file routes
} as any)
const taskDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tasks/$taskId',
  component: () => null,
})
const routeTree = rootRoute.addChildren([InboxRoute, taskDetailRoute])

async function renderInboxRoute() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/inbox'] }),
  })
  await router.load()
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

function boardSnapshot() {
  const regions = screen.getAllByRole('region')
  const taskNames = ['Move to inbox']
  return {
    columns: regions.map((region) => region.getAttribute('aria-label')),
    taskColumns: taskNames.map((title) =>
      regions
        .find((region) => within(region).queryByText(title) != null)
        ?.getAttribute('aria-label'),
    ),
    mutations: mocks.mutate.mock.calls,
  }
}

async function dragTaskToRegion(title: string, target: HTMLElement) {
  const source = (await screen.findByText(title)).closest('[role="button"]')
  if (!(source instanceof HTMLElement)) {
    throw new Error('Could not find drag source')
  }

  const sourceRect = source.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()
  const sourceX = sourceRect.x + sourceRect.width / 2
  const sourceY = sourceRect.y + sourceRect.height / 2
  const targetX = targetRect.x + targetRect.width / 2
  const targetY = targetRect.y + targetRect.height / 2

  fireEvent.mouseDown(source, { button: 0, clientX: sourceX, clientY: sourceY })
  fireEvent.mouseMove(document, {
    buttons: 1,
    clientX: sourceX + 10,
    clientY: sourceY + 10,
  })
  fireEvent.mouseMove(document, {
    buttons: 1,
    clientX: targetX,
    clientY: targetY,
  })
  fireEvent.mouseUp(document, { button: 0, clientX: targetX, clientY: targetY })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.fetchTaskList.mockImplementation((filter) =>
    Promise.resolve(filter.priority === '-1' ? [deferredTask] : []),
  )
  mocks.useTaskList.mockReturnValue({
    categorized: { all: [] },
    isLoading: false,
    isError: false,
  })
})

describe('InboxRoute', () => {
  it('orders columns by settings and immediately moves a task to the dropped priority', async () => {
    await renderInboxRoute()
    await screen.findByText('Move to inbox')

    const inboxRegion = screen.getByRole('region', { name: 'Inbox tasks' })
    await dragTaskToRegion('Move to inbox', inboxRegion)

    await waitFor(() => {
      expect(boardSnapshot()).toEqual({
        columns: [
          'Later tasks',
          'Inbox tasks',
          'Normal tasks',
          'Now tasks',
          'Next tasks',
          'Waiting tasks',
        ],
        taskColumns: ['Inbox tasks'],
        mutations: [[{ id: 'deferred-task', input: { priority: null } }]],
      })
    })
  })
})
