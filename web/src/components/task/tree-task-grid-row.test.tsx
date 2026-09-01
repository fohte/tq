import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { makeNode } from '#components/task/task-row-test-fixtures'
import { TreeTaskGridRow } from '#components/task/tree-task-grid-row'
import type { TaskAgentSession } from '#hooks/use-task-agent-sessions'
import type { TreeNode } from '#hooks/use-tasks'
import { useTreeOutliner } from '#hooks/use-tree-outliner'
import { atIndex } from '#lib/test-utils'

const mockMutate = vi.fn()
const mockUpdateStatusMutate = vi.fn()
// Fires when a click bubbles up to the row's Link. A tag token's onClick
// calls stopPropagation, so this spy lets tests confirm that click never
// reaches the Link (i.e. no navigation), without relying on jsdom's <a> not
// actually navigating.
const mockLinkOnClick = vi.fn()
const mockUseProject = vi.fn()

// LinkExistingTaskMenu/MoveUnderTaskMenu/SetProjectMenu/DeleteTaskDialog
// (rendered unconditionally by every row, controlled via their own `open`
// prop) also pull from this module. All dialogs start closed, so their
// queries stay disabled — these stubs only need to exist, not do anything.
vi.mock('#hooks/use-tasks', () => ({
  useCompleteTask: () => ({ mutate: mockMutate }),
  useUpdateTaskStatus: () => ({ mutate: mockUpdateStatusMutate }),
  useTaskList: () => ({ categorized: { all: [] } }),
  useUpdateTaskParent: () => ({ mutate: vi.fn() }),
  useUpdateTask: () => ({ mutate: vi.fn() }),
  useDeleteTask: () => ({ mutate: vi.fn() }),
}))

vi.mock('#hooks/use-projects', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#hooks/use-projects')>()
  return {
    ...actual,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- mock delegation
    useProject: (...args: unknown[]) => mockUseProject(...args),
  }
})

// Only Link is stubbed (to spy on mockLinkOnClick instead of really
// navigating) — useNavigate/router-building exports stay real so a tag
// token's navigate({ to: '/tasks', ... }) keeps working.
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    Link: ({
      children,
      ...props
    }: { children: React.ReactNode } & Record<string, unknown>) => (
      <a
        href={typeof props['to'] === 'string' ? props['to'] : '#'}
        onClick={mockLinkOnClick}
      >
        {children}
      </a>
    ),
  }
})

// Base UI's Menu relies on pointer events that jsdom does not implement
// reliably, so the picker is stubbed here to exercise TreeTaskGridRow's
// status change wiring directly. The real menu interaction is covered by
// task-status-picker.stories.tsx (runs in a real browser via Storybook).
// Not shared with the other row test files: vi.mock factories are hoisted
// above imports, so a shared factory couldn't close over anything defined
// after the mock call, and vi.mock itself must stay inline per-file.
vi.mock('#components/task/task-status-picker', () => ({
  TaskStatusPicker: ({
    onStatusChange,
  }: {
    status: string
    onStatusChange: (status: string) => void
  }) => (
    <div>
      <button
        onClick={() => {
          onStatusChange('todo')
        }}
      >
        Set Todo
      </button>
      <button
        onClick={() => {
          onStatusChange('completed')
        }}
      >
        Set Completed
      </button>
    </div>
  ),
}))

// Expand/collapse, selection, and the outliner input are all owned by
// useTreeOutliner rather than local state, so the row under test is driven
// through the real hook instead of a hand-rolled prop harness.
function TreeHarness({
  node,
  sessionsByTaskId = new Map(),
}: {
  node: TreeNode
  sessionsByTaskId?: ReadonlyMap<string, TaskAgentSession[]>
}) {
  const outliner = useTreeOutliner([node], { enabled: true })

  return (
    <TreeTaskGridRow
      node={node}
      sessionsByTaskId={sessionsByTaskId}
      isExpanded={outliner.isExpanded}
      onToggleExpand={outliner.toggleExpand}
      selectedRowId={outliner.selectedRowId}
      onSelectRow={outliner.selectRow}
      onOpenChildInput={outliner.openChildInput}
    />
  )
}

// The router's first route match resolves asynchronously even with no
// loaders, so router.load() is awaited before render() to avoid an initial
// blank paint (see https://tanstack.com/router/latest/docs/framework/react/guide/testing).
async function renderTree(
  node: TreeNode,
  sessionsByTaskId: ReadonlyMap<string, TaskAgentSession[]> = new Map(),
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const rootRoute = createRootRoute({
    validateSearch: (search: Record<string, unknown>) => search,
    component: () => (
      <TreeHarness node={node} sessionsByTaskId={sessionsByTaskId} />
    ),
  })
  // A tag token navigates to /tasks, so that route must be registered for
  // the navigation to resolve instead of erroring on an unmatched route.
  const tasksRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/tasks',
    component: () => null,
  })
  rootRoute.addChildren([tasksRoute])
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()

  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
    router,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseProject.mockReturnValue({ data: undefined })
})

// The row renders its content exactly once, as a single two-line flex
// layout used for both desktop and mobile.
describe('TreeTaskGridRow', () => {
  it('renders task title', async () => {
    await renderTree(makeNode())
    expect(screen.getByText('Parent Task')).toBeInTheDocument()
  })

  it('renders a row-actions trigger for the ⋯ menu', async () => {
    await renderTree(makeNode())
    // ActionsMenu itself renders one trigger per layout (desktop dropdown +
    // mobile action sheet), and the row mounts TreeRowActionsMenu once.
    expect(screen.getAllByLabelText('Task actions')).toHaveLength(2)
  })

  it('renders the task number', async () => {
    await renderTree(makeNode({ number: 42 }))
    expect(screen.getByText('#42')).toBeInTheDocument()
  })

  it('shows child completion count', async () => {
    const node = makeNode({ childCompletionCount: { completed: 1, total: 3 } })
    await renderTree(node)
    expect(screen.getByTestId('child-completion')).toHaveTextContent('1/3')
  })

  it('does not show child completion count when no children', async () => {
    await renderTree(makeNode())
    expect(screen.queryByTestId('child-completion')).not.toBeInTheDocument()
  })

  it('does not show expand toggle for leaf nodes', async () => {
    // A leaf node rendered alone has no expand toggle
    const leaf = makeNode({ id: 'leaf-1', title: 'Leaf Task' })
    await renderTree(leaf)
    expect(screen.queryByLabelText('Collapse')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Expand')).not.toBeInTheDocument()
  })

  it('does not show an expand toggle for a childless task with sessions', async () => {
    const node = makeNode({ id: 'parent-1', children: [] })
    const session: TaskAgentSession = {
      id: 'session-1',
      taskId: 'parent-1',
      taskNumber: 1,
      taskTitle: 'Parent task',
      taskParentId: null,
      provider: 'claude_code',
      sessionId: 'sess-1',
      parentSessionId: null,
      context: 'work',
      cwd: '/home/fohte/project',
      label: 'Fix bug',
      lastMessage: null,
      customLabel: null,
      startedAt: '2026-03-20T00:00:00.000Z',
      lastActiveAt: new Date().toISOString(),
      endedAt: null,
    }
    await renderTree(node, new Map([['parent-1', [session]]]))

    expect(screen.queryByLabelText('Collapse')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Expand')).not.toBeInTheDocument()
  })

  it('shows a session indicator for a task with sessions', async () => {
    const node = makeNode({ id: 'parent-1', children: [] })
    const session: TaskAgentSession = {
      id: 'session-1',
      taskId: 'parent-1',
      taskNumber: 1,
      taskTitle: 'Parent task',
      taskParentId: null,
      provider: 'claude_code',
      sessionId: 'sess-1',
      parentSessionId: null,
      context: 'work',
      cwd: '/home/fohte/project',
      label: 'Fix bug',
      lastMessage: null,
      customLabel: null,
      startedAt: '2026-03-20T00:00:00.000Z',
      lastActiveAt: new Date().toISOString(),
      endedAt: null,
    }
    await renderTree(node, new Map([['parent-1', [session]]]))

    expect(screen.getByTestId('session-indicator')).toBeInTheDocument()
  })

  it('does not show a session indicator when there are no sessions', async () => {
    await renderTree(makeNode())
    expect(screen.queryByTestId('session-indicator')).not.toBeInTheDocument()
  })

  it('does not show a GitHub badge when there is no link', async () => {
    await renderTree(makeNode())
    expect(screen.queryByText('tq#42')).not.toBeInTheDocument()
  })

  it('shows a GitHub badge when linked', async () => {
    const node = makeNode({
      githubLinks: [
        {
          id: 'link-1',
          owner: 'fohte',
          repo: 'tq',
          number: 42,
          kind: 'issue',
          url: 'https://github.com/fohte/tq/issues/42',
          state: 'open',
          title: 'Linked issue',
          lastSyncedAt: '2026-03-20T00:00:00.000Z',
        },
      ],
    })
    await renderTree(node)
    // The badge only renders in the row's second line when present.
    expect(screen.getAllByText('tq#42')).toHaveLength(1)
  })

  it('does not show a project label when the task has no project', async () => {
    await renderTree(makeNode({ projectId: null }))
    expect(mockUseProject).not.toHaveBeenCalled()
  })

  it('shows a project label when the task has a project', async () => {
    mockUseProject.mockReturnValue({
      data: { id: 'project-1', title: 'tq' },
    })
    await renderTree(makeNode({ projectId: 'project-1' }))
    expect(mockUseProject).toHaveBeenCalledWith('project-1')
    expect(screen.getByText('tq')).toBeInTheDocument()
  })

  it('shows a start date badge when the task has a start date', async () => {
    await renderTree(makeNode({ startDate: '2026-03-25' }))
    expect(screen.getByText('Mar 25')).toBeInTheDocument()
  })

  it('does not show a start date badge when the task has no start date', async () => {
    await renderTree(makeNode({ startDate: null }))
    expect(screen.queryByText('Mar 25')).not.toBeInTheDocument()
  })

  it('shows the context', async () => {
    await renderTree(makeNode({ context: 'work' }))
    expect(screen.getByText('work')).toBeInTheDocument()
  })

  it('shows a due date badge when the task has a due date', async () => {
    await renderTree(makeNode({ dueDate: '2026-03-25' }))
    expect(screen.getByText('Mar 25')).toBeInTheDocument()
  })

  it('does not show a due date badge when the task has no due date', async () => {
    await renderTree(makeNode({ dueDate: null }))
    expect(screen.queryByText('Mar 25')).not.toBeInTheDocument()
  })

  it('does not render tag tokens when there are no labels', async () => {
    await renderTree(makeNode({ labels: [] }))
    // Tag tokens render as buttons; the task number label (a <span>) also
    // starts with "#", so scope the query to buttons to avoid a false match.
    expect(screen.queryByRole('button', { name: /^#/ })).not.toBeInTheDocument()
  })

  it('renders a token per label', async () => {
    await renderTree(makeNode({ labels: ['dev:tq', 'chore'] }))
    expect(
      screen.getAllByRole('button', { name: /^#/ }).map((el) => el.textContent),
    ).toEqual(['#dev:tq', '#chore'])
  })

  it('navigates to /tasks scoped to the tag and stops the click from reaching the row Link when a tag token is clicked', async () => {
    const user = userEvent.setup()
    const { router } = await renderTree(makeNode({ labels: ['dev:tq'] }))

    await user.click(atIndex(screen.getAllByText('#dev:tq'), 0))

    expect(router.state.location.pathname).toBe('/tasks')
    expect(router.state.location.search).toEqual({
      q: 'is:todo label:dev:tq sort:updated',
    })
    expect(mockLinkOnClick).not.toHaveBeenCalled()
  })

  it('selects the row and navigates when clicking its non-interactive area', async () => {
    const user = userEvent.setup()
    await renderTree(makeNode())

    const title = screen.getByText('Parent Task')
    await user.click(title)

    const wrapper = title.closest('.group')
    if (!(wrapper instanceof HTMLElement)) {
      throw new Error('Expected a row wrapper carrying the "group" class')
    }

    const observed: unknown[] = []
    observed.push(wrapper.classList.contains('ring-border-strong'))
    observed.push(mockLinkOnClick.mock.calls.length)

    expect(observed).toEqual([true, 1])
  })

  it('updates the status via useUpdateTaskStatus when reopening a completed task', async () => {
    const user = userEvent.setup()
    await renderTree(makeNode({ status: 'completed' }))

    await user.click(atIndex(screen.getAllByText('Set Todo'), 0))

    expect(mockUpdateStatusMutate).toHaveBeenCalledWith({
      id: 'parent-1',
      status: 'todo',
    })
    expect(mockMutate).not.toHaveBeenCalled()
  })

  it('completes the task via useCompleteTask when completed is selected', async () => {
    const user = userEvent.setup()
    await renderTree(makeNode({ status: 'todo' }))

    await user.click(atIndex(screen.getAllByText('Set Completed'), 0))

    expect(mockMutate).toHaveBeenCalledWith('parent-1')
    expect(mockUpdateStatusMutate).not.toHaveBeenCalled()
  })

  it('does nothing when the currently selected status is chosen again', async () => {
    const user = userEvent.setup()
    await renderTree(makeNode({ status: 'todo' }))

    await user.click(atIndex(screen.getAllByText('Set Todo'), 0))

    expect(mockMutate).not.toHaveBeenCalled()
    expect(mockUpdateStatusMutate).not.toHaveBeenCalled()
  })
})
