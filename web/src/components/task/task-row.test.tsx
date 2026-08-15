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

import { TreeTaskRow } from '#components/task/task-row'
import { makeNode } from '#components/task/task-row-test-fixtures'
import type { TreeNode } from '#hooks/use-tasks'
import { atIndex } from '#lib/test-utils'

const mockMutate = vi.fn()
const mockUpdateStatusMutate = vi.fn()
// Fires when a click bubbles up to the row's Link. A tag token's onClick
// calls stopPropagation, so this spy lets tests confirm that click never
// reaches the Link (i.e. no navigation), without relying on jsdom's <a> not
// actually navigating.
const mockLinkOnClick = vi.fn()

vi.mock('#hooks/use-tasks', () => ({
  useCompleteTask: () => ({ mutate: mockMutate }),
  useUpdateTaskStatus: () => ({ mutate: mockUpdateStatusMutate }),
}))

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
// reliably, so the picker is stubbed here to exercise TreeTaskRow's status
// change wiring directly. The real menu interaction is covered by
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
          onStatusChange('in_progress')
        }}
      >
        Set In Progress
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

// The router's first route match resolves asynchronously even with no
// loaders, so router.load() is awaited before render() to avoid an initial
// blank paint (see https://tanstack.com/router/latest/docs/framework/react/guide/testing).
async function renderTree(node: TreeNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const rootRoute = createRootRoute({
    validateSearch: (search: Record<string, unknown>) => search,
    component: () => <TreeTaskRow node={node} />,
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
})

describe('TreeTaskRow', () => {
  it('renders task title', async () => {
    await renderTree(makeNode())
    expect(screen.getByText('Parent Task')).toBeInTheDocument()
  })

  it('renders the task number', async () => {
    await renderTree(makeNode({ number: 42 }))
    expect(screen.getByText('#42')).toBeInTheDocument()
  })

  it('renders children under parent', async () => {
    const node = makeNode({
      children: [
        makeNode({ id: 'child-1', title: 'Child Task', parentId: 'parent-1' }),
      ],
      childCompletionCount: { completed: 0, total: 1 },
    })
    await renderTree(node)
    expect(screen.getByText('Parent Task')).toBeInTheDocument()
    expect(screen.getByText('Child Task')).toBeInTheDocument()
  })

  it('shows child completion count', async () => {
    const node = makeNode({
      children: [
        makeNode({
          id: 'child-1',
          title: 'Child 1',
          status: 'completed',
          parentId: 'parent-1',
        }),
        makeNode({
          id: 'child-2',
          title: 'Child 2',
          parentId: 'parent-1',
        }),
        makeNode({
          id: 'child-3',
          title: 'Child 3',
          parentId: 'parent-1',
        }),
      ],
      childCompletionCount: { completed: 1, total: 3 },
    })
    await renderTree(node)
    const completions = screen.getAllByTestId('child-completion')
    // Parent node should show 1/3
    expect(atIndex(completions, 0)).toHaveTextContent('1/3')
  })

  it('does not show child completion count when no children', async () => {
    await renderTree(makeNode())
    expect(screen.queryByTestId('child-completion')).not.toBeInTheDocument()
  })

  it('collapses children when toggle is clicked', async () => {
    const user = userEvent.setup()
    const node = makeNode({
      children: [
        makeNode({ id: 'child-1', title: 'Child Task', parentId: 'parent-1' }),
      ],
      childCompletionCount: { completed: 0, total: 1 },
    })
    await renderTree(node)

    // Children visible by default
    expect(screen.getByText('Child Task')).toBeInTheDocument()

    // Click collapse button
    const collapseBtn = atIndex(screen.getAllByLabelText('Collapse'), 0)
    await user.click(collapseBtn)

    // Children hidden
    expect(screen.queryByText('Child Task')).not.toBeInTheDocument()
  })

  it('expands children when toggle is clicked after collapse', async () => {
    const user = userEvent.setup()
    const node = makeNode({
      children: [
        makeNode({ id: 'child-1', title: 'Child Task', parentId: 'parent-1' }),
      ],
      childCompletionCount: { completed: 0, total: 1 },
    })
    await renderTree(node)

    // Collapse
    await user.click(atIndex(screen.getAllByLabelText('Collapse'), 0))
    expect(screen.queryByText('Child Task')).not.toBeInTheDocument()

    // Expand
    await user.click(screen.getByLabelText('Expand'))
    expect(screen.getByText('Child Task')).toBeInTheDocument()
  })

  it('renders nested children (grandchildren)', async () => {
    const grandchild = makeNode({
      id: 'grandchild-1',
      title: 'Grandchild Task',
      parentId: 'child-1',
    })
    const child = makeNode({
      id: 'child-1',
      title: 'Child Task',
      parentId: 'parent-1',
      children: [grandchild],
      childCompletionCount: { completed: 0, total: 1 },
    })
    const node = makeNode({
      children: [child],
      childCompletionCount: { completed: 0, total: 1 },
    })
    await renderTree(node)

    expect(screen.getByText('Parent Task')).toBeInTheDocument()
    expect(screen.getByText('Child Task')).toBeInTheDocument()
    expect(screen.getByText('Grandchild Task')).toBeInTheDocument()
  })

  it('does not show expand toggle for leaf nodes', async () => {
    // A leaf node rendered alone has no expand toggle
    const leaf = makeNode({ id: 'leaf-1', title: 'Leaf Task' })
    await renderTree(leaf)
    expect(screen.queryByLabelText('Collapse')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Expand')).not.toBeInTheDocument()
  })

  it('does not show a GitHub badge when there is no link', async () => {
    await renderTree(makeNode())
    expect(screen.queryByText('tq#42')).not.toBeInTheDocument()
  })

  it('shows a GitHub badge when linked', async () => {
    const node = makeNode({
      githubLink: {
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
    })
    await renderTree(node)
    expect(screen.getByText('tq#42')).toBeInTheDocument()
  })

  it('shows a context badge for personal tasks', async () => {
    await renderTree(makeNode({ context: 'personal' }))
    expect(screen.getByText('personal')).toBeInTheDocument()
  })

  it('shows a context badge for work tasks', async () => {
    await renderTree(makeNode({ context: 'work' }))
    expect(screen.getByText('work')).toBeInTheDocument()
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

    await user.click(screen.getByText('#dev:tq'))

    expect(router.state.location.pathname).toBe('/tasks')
    expect(router.state.location.search).toEqual({
      q: 'is:todo is:in_progress sort:updated label:dev:tq',
    })
    expect(mockLinkOnClick).not.toHaveBeenCalled()
  })

  it('lets a click bubble to the row Link when clicking elsewhere in the row', async () => {
    // Control for the tag-token test above: proves mockLinkOnClick actually
    // observes bubbled clicks, so its absence there means something.
    const user = userEvent.setup()
    await renderTree(makeNode({ labels: ['dev:tq'] }))

    await user.click(screen.getByText('Parent Task'))

    expect(mockLinkOnClick).toHaveBeenCalled()
  })

  it('updates the status via useUpdateTaskStatus when a non-completed status is selected', async () => {
    const user = userEvent.setup()
    await renderTree(makeNode({ status: 'todo' }))

    await user.click(screen.getByText('Set In Progress'))

    expect(mockUpdateStatusMutate).toHaveBeenCalledWith({
      id: 'parent-1',
      status: 'in_progress',
    })
    expect(mockMutate).not.toHaveBeenCalled()
  })

  it('completes the task via useCompleteTask when completed is selected', async () => {
    const user = userEvent.setup()
    await renderTree(makeNode({ status: 'todo' }))

    await user.click(screen.getByText('Set Completed'))

    expect(mockMutate).toHaveBeenCalledWith('parent-1')
    expect(mockUpdateStatusMutate).not.toHaveBeenCalled()
  })

  it('does nothing when the currently selected status is chosen again', async () => {
    const user = userEvent.setup()
    await renderTree(makeNode({ status: 'todo' }))

    await user.click(screen.getByText('Set Todo'))

    expect(mockMutate).not.toHaveBeenCalled()
    expect(mockUpdateStatusMutate).not.toHaveBeenCalled()
  })
})
