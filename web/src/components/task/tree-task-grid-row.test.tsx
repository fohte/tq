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

import { ROW_INDENT_CLASS_NAME } from '#components/task/task-row-shared'
import { makeNode } from '#components/task/task-row-test-fixtures'
import { TreeTaskGridRow } from '#components/task/tree-task-grid-row'
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

// LinkExistingTaskMenu/MoveUnderTaskMenu/SetProjectMenu (rendered
// unconditionally by every row, controlled via their own `open` prop) also
// pull from this module. All dialogs start closed, so their queries stay
// disabled — these stubs only need to exist, not do anything.
vi.mock('#hooks/use-tasks', () => ({
  useCompleteTask: () => ({ mutate: mockMutate }),
  useUpdateTaskStatus: () => ({ mutate: mockUpdateStatusMutate }),
  useTaskList: () => ({ categorized: { all: [] } }),
  useUpdateTaskParent: () => ({ mutate: vi.fn() }),
  useUpdateTask: () => ({ mutate: vi.fn() }),
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

// Expand/collapse, selection, and the outliner input are all owned by
// useTreeOutliner rather than local state, so the row under test is driven
// through the real hook instead of a hand-rolled prop harness.
function TreeHarness({ node }: { node: TreeNode }) {
  const outliner = useTreeOutliner([node], { enabled: true })

  return (
    <TreeTaskGridRow
      node={node}
      isExpanded={outliner.isExpanded}
      onToggleExpand={outliner.toggleExpand}
      selectedRowId={outliner.selectedRowId}
      onSelectRow={outliner.selectRow}
      outlinerInput={outliner.outlinerInput}
      outlinerTarget={outliner.outlinerTarget}
      onOpenChildInput={outliner.openChildInput}
      onCloseOutlinerInput={outliner.closeOutlinerInput}
      onIndentOutlinerInput={outliner.indentOutlinerInput}
      onOutdentOutlinerInput={outliner.outdentOutlinerInput}
    />
  )
}

// The router's first route match resolves asynchronously even with no
// loaders, so router.load() is awaited before render() to avoid an initial
// blank paint (see https://tanstack.com/router/latest/docs/framework/react/guide/testing).
async function renderTree(node: TreeNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const rootRoute = createRootRoute({
    validateSearch: (search: Record<string, unknown>) => search,
    component: () => <TreeHarness node={node} />,
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

// The component renders a desktop grid and a mobile stack simultaneously
// (CSS media queries choose which is visible; jsdom has no viewport so both
// are queryable). Assertions below pin the count to 2 rather than just
// "at least one" so a regression in either layout alone still fails.
describe('TreeTaskGridRow', () => {
  it('renders task title', async () => {
    await renderTree(makeNode())
    expect(screen.getAllByText('Parent Task')).toHaveLength(2)
  })

  it('renders a row-actions trigger for the ⋯ menu', async () => {
    await renderTree(makeNode())
    // TreeRowActionsMenu itself renders one trigger per layout (desktop
    // dropdown + mobile action sheet), and the row mounts it once for the
    // desktop grid section and once for the mobile stack section: 2 x 2.
    expect(screen.getAllByLabelText('Task actions')).toHaveLength(4)
  })

  it('renders the task number', async () => {
    await renderTree(makeNode({ number: 42 }))
    expect(screen.getAllByText('#42')).toHaveLength(2)
  })

  it('indents deeper rows more than their ancestors', async () => {
    const grandchild = makeNode({
      id: 'grandchild-1',
      title: 'Grandchild Task',
    })
    const child = makeNode({
      id: 'child-1',
      title: 'Child Task',
      children: [grandchild],
      childCompletionCount: { completed: 0, total: 1 },
    })
    const node = makeNode({
      children: [child],
      childCompletionCount: { completed: 0, total: 1 },
    })
    await renderTree(node)

    const rowIndentUnits = (text: string) => {
      const el = atIndex(screen.getAllByText(text), 0).closest(
        '[style*="--row-indent"]',
      )
      if (!(el instanceof HTMLElement)) {
        throw new Error(`Expected an element with --row-indent near "${text}"`)
      }
      expect(el.classList.contains(ROW_INDENT_CLASS_NAME)).toBe(true)
      const value = el.style.getPropertyValue('--row-indent')
      const match = /\d+/.exec(value)
      if (match == null) {
        throw new Error(`Unexpected --row-indent value: "${value}"`)
      }
      return Number.parseInt(match[0], 10)
    }

    const depths = [
      rowIndentUnits('Parent Task'),
      rowIndentUnits('Child Task'),
      rowIndentUnits('Grandchild Task'),
    ]

    expect(depths.every((px, i) => i === 0 || px > (depths[i - 1] ?? 0))).toBe(
      true,
    )
  })

  it('renders children under parent', async () => {
    const node = makeNode({
      children: [
        makeNode({ id: 'child-1', title: 'Child Task', parentId: 'parent-1' }),
      ],
      childCompletionCount: { completed: 0, total: 1 },
    })
    await renderTree(node)
    expect(screen.getAllByText('Parent Task')).toHaveLength(2)
    expect(screen.getAllByText('Child Task')).toHaveLength(2)
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
    // Parent node should show 1/3, once per layout (desktop + mobile); none
    // of the children have children of their own, so they show nothing.
    const completions = screen.getAllByTestId('child-completion')
    expect(completions).toHaveLength(2)
    expect(atIndex(completions, 0)).toHaveTextContent('1/3')
    expect(atIndex(completions, 1)).toHaveTextContent('1/3')
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
    expect(screen.getAllByText('Child Task')).toHaveLength(2)

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
    await user.click(atIndex(screen.getAllByLabelText('Expand'), 0))
    expect(screen.getAllByText('Child Task')).toHaveLength(2)
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

    expect(screen.getAllByText('Parent Task')).toHaveLength(2)
    expect(screen.getAllByText('Child Task')).toHaveLength(2)
    expect(screen.getAllByText('Grandchild Task')).toHaveLength(2)
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
    // The LINK column only exists in the desktop grid.
    expect(screen.getAllByText('tq#42')).toHaveLength(1)
  })

  it('shows a context badge for personal tasks', async () => {
    await renderTree(makeNode({ context: 'personal' }))
    expect(screen.getAllByText('personal')).toHaveLength(2)
  })

  it('shows a context badge for work tasks', async () => {
    await renderTree(makeNode({ context: 'work' }))
    expect(screen.getAllByText('work')).toHaveLength(2)
  })

  it('does not render tag tokens when there are no labels', async () => {
    await renderTree(makeNode({ labels: [] }))
    // Tag tokens render as buttons; the task number label (a <span>) also
    // starts with "#", so scope the query to buttons to avoid a false match.
    expect(screen.queryByRole('button', { name: /^#/ })).not.toBeInTheDocument()
  })

  it('renders a token per label', async () => {
    await renderTree(makeNode({ labels: ['dev:tq', 'chore'] }))
    // Desktop and mobile layouts both render, so each label's token appears
    // twice, in layout order.
    expect(
      screen.getAllByRole('button', { name: /^#/ }).map((el) => el.textContent),
    ).toEqual(['#dev:tq', '#chore', '#dev:tq', '#chore'])
  })

  it('highlights an overdue due date', async () => {
    await renderTree(makeNode({ dueDate: '2020-01-01' }))
    const badges = screen.getAllByText('Jan 1, 2020')
    expect(badges.map((b) => b.classList.contains('text-primary'))).toEqual([
      true,
      true,
    ])
  })

  it('navigates to /tasks scoped to the tag and stops the click from reaching the row Link when a tag token is clicked', async () => {
    const user = userEvent.setup()
    const { router } = await renderTree(makeNode({ labels: ['dev:tq'] }))

    await user.click(atIndex(screen.getAllByText('#dev:tq'), 0))

    expect(router.state.location.pathname).toBe('/tasks')
    expect(router.state.location.search).toEqual({
      q: 'is:todo is:in_progress label:dev:tq sort:updated',
    })
    expect(mockLinkOnClick).not.toHaveBeenCalled()
  })

  it('selects the row and navigates when clicking its desktop non-interactive area', async () => {
    const user = userEvent.setup()
    await renderTree(makeNode())

    // The desktop grid is the first ("Parent Task" x2) instance in render
    // order.
    const desktopTitle = atIndex(screen.getAllByText('Parent Task'), 0)
    await user.click(desktopTitle)

    const wrapper = desktopTitle.closest('.group')
    if (!(wrapper instanceof HTMLElement)) {
      throw new Error('Expected a row wrapper carrying the "group" class')
    }

    const observed: unknown[] = []
    observed.push(wrapper.classList.contains('ring-border-strong'))
    observed.push(mockLinkOnClick.mock.calls.length)

    expect(observed).toEqual([true, 1])
  })

  it('still lets a click bubble to the row Link from the mobile layout', async () => {
    // Control for the desktop-selection test above: proves mockLinkOnClick
    // actually observes bubbled clicks, so a row tap still navigates on the
    // touch layout, which has no onClick of its own to intercept it.
    const user = userEvent.setup()
    await renderTree(makeNode({ labels: ['dev:tq'] }))

    await user.click(atIndex(screen.getAllByText('Parent Task'), 1))

    expect(mockLinkOnClick).toHaveBeenCalled()
  })

  it('updates the status via useUpdateTaskStatus when a non-completed status is selected', async () => {
    const user = userEvent.setup()
    await renderTree(makeNode({ status: 'todo' }))

    await user.click(atIndex(screen.getAllByText('Set In Progress'), 0))

    expect(mockUpdateStatusMutate).toHaveBeenCalledWith({
      id: 'parent-1',
      status: 'in_progress',
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
