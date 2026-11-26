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

import { makePrioritySettingsInOrder } from '#components/task/priority-settings-test-fixtures'
import { makeTask } from '#components/task/task-row-test-fixtures'
import type { PrioritySetting } from '#hooks/use-priority-settings'
import type { Task, TaskListFilter } from '#hooks/use-tasks'
import { Route as InboxRoute } from '#routes/inbox'

const settings = makePrioritySettingsInOrder([-1, null, 0, 2, 1])
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
  usePrioritySettings: vi.fn<
    () => {
      data: PrioritySetting[] | undefined
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
  usePrioritySettings: () => mocks.usePrioritySettings(),
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

function boardColumnNames() {
  const regions = screen.getAllByRole('region')
  return regions.map((region) => region.getAttribute('aria-label'))
}

function taskMovementSnapshot() {
  const regions = screen.getAllByRole('region')
  return {
    taskColumn: regions
      .find((region) => within(region).queryByText('Move to inbox') != null)
      ?.getAttribute('aria-label'),
    mutations: mocks.mutate.mock.calls,
  }
}

function prioritySettingsLoadingSnapshot() {
  return {
    columns: boardColumnNames(),
    message: screen.getByText('Loading priority settings...').textContent,
  }
}

function prioritySettingsErrorSnapshot() {
  return {
    columns: boardColumnNames(),
    message: screen.getByText('Failed to load priority settings.').textContent,
    waitingTaskVisible:
      within(screen.getByRole('region', { name: 'Waiting tasks' })).queryByText(
        'Waiting',
      ) != null,
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
  mocks.usePrioritySettings.mockReturnValue({
    data: settings,
    isLoading: false,
    isError: false,
  })
})

describe('InboxRoute', () => {
  it('orders columns by priority settings', async () => {
    await renderInboxRoute()
    await screen.findByText('Move to inbox')

    expect(boardColumnNames()).toEqual([
      'Later tasks',
      'Inbox tasks',
      'Normal tasks',
      'Now tasks',
      'Next tasks',
      'Waiting tasks',
    ])
  })

  it('immediately moves a dropped task and updates its priority', async () => {
    await renderInboxRoute()
    await screen.findByText('Move to inbox')

    const inboxRegion = screen.getByRole('region', { name: 'Inbox tasks' })
    await dragTaskToRegion('Move to inbox', inboxRegion)

    await waitFor(() => {
      expect(taskMovementSnapshot()).toEqual({
        taskColumn: 'Inbox tasks',
        mutations: [[{ id: 'deferred-task', input: { priority: null } }]],
      })
    })
  })

  it('shows a loading state while priority settings load', async () => {
    mocks.usePrioritySettings.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    })

    await renderInboxRoute()
    await screen.findByText('Loading priority settings...')

    expect(prioritySettingsLoadingSnapshot()).toEqual({
      columns: ['Priorities tasks', 'Waiting tasks'],
      message: 'Loading priority settings...',
    })
  })

  it('shows a priority settings error and keeps the waiting column', async () => {
    mocks.usePrioritySettings.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    })
    mocks.useTaskList.mockReturnValue({
      categorized: {
        all: [makeTask({ id: 'waiting-task', title: 'Waiting' })],
      },
      isLoading: false,
      isError: false,
    })

    await renderInboxRoute()
    await screen.findByText('Failed to load priority settings.')

    expect(prioritySettingsErrorSnapshot()).toEqual({
      columns: ['Priorities tasks', 'Waiting tasks'],
      message: 'Failed to load priority settings.',
      waitingTaskVisible: true,
    })
  })
})
