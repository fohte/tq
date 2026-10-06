import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from '@vitest/browser/context'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { makeTaskAgentSession } from '#components/agent-session/task-agent-session-test-fixtures'
import { makeGithubLink } from '#components/task/github-link-test-fixtures'
import { makeNode } from '#components/task/task-row-test-fixtures'
import { TreeTaskGridRow } from '#components/task/tree-task-grid-row'
import type { TaskAgentSession } from '#hooks/use-task-agent-sessions'
import type { TreeNode } from '#hooks/use-tasks'
import { useTreeOutliner } from '#hooks/use-tree-outliner'
import { assertDefined, atIndex } from '#lib/test-utils'
import { MOBILE_VIEWPORT } from '#storybook-config/screenshot-viewports'

const mockSelectRow = vi.fn()
// Fires when a click bubbles up to the row's Link. A tag token's onClick
// calls stopPropagation, so this spy lets tests confirm that click never
// reaches the Link (i.e. no navigation), without relying on jsdom's <a> not
// actually navigating.
const mockLinkOnClick = vi.fn()
const mockUseProject = vi.fn()

// Row subcomponents and task-row-shared import these hooks, so their exports
// must exist in this mock.
vi.mock('#hooks/use-tasks', () => ({
  useTaskList: () => ({ categorized: { all: [] } }),
  useUpdateTaskParent: () => ({ mutate: vi.fn() }),
  useUpdateTask: () => ({ mutate: vi.fn() }),
  useDeleteTask: () => ({ mutate: vi.fn() }),
  useCompleteTask: () => ({ mutate: vi.fn() }),
  useUpdateTaskStatus: () => ({ mutate: vi.fn() }),
}))

vi.mock('#hooks/use-projects', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#hooks/use-projects')>()
  return {
    ...actual,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- mock delegation
    useProject: (...args: unknown[]) => mockUseProject(...args),
  }
})

// Only Link is stubbed so its synthetic click can be observed without
// navigating. Router-building exports stay real for tag navigation.
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
        onClick={(event: React.MouseEvent) => {
          // Stop the real navigation a browser would follow on this href.
          event.preventDefault()
          mockLinkOnClick(event)
        }}
      >
        {children}
      </a>
    ),
  }
})

// Expand/collapse and selection are owned by useTreeOutliner rather than
// local state, so the row under test is driven through the real hook
// instead of a hand-rolled prop harness.
function TreeHarness({
  node,
  sessionsByTaskId = new Map(),
}: {
  node: TreeNode
  sessionsByTaskId?: ReadonlyMap<string, TaskAgentSession[]>
}) {
  const outliner = useTreeOutliner([node], {
    enabled: true,
    onOpenSiblingCreate: () => {},
  })

  return (
    <TreeTaskGridRow
      node={node}
      hasChildren={node.children.length > 0}
      sessionsByTaskId={sessionsByTaskId}
      isExpanded={outliner.isExpanded}
      onToggleExpand={outliner.toggleExpand}
      selectedRowId={outliner.selectedRowId}
      onSelectRow={(id) => {
        outliner.selectRow(id)
        mockSelectRow(id)
      }}
      onAddSubtask={() => {}}
    />
  )
}

// The router's first route match resolves asynchronously even with no
// loaders, so router.load() is awaited before render() to avoid an initial
// blank paint (see https://tanstack.com/router/latest/docs/framework/react/guide/testing).
async function renderTree(
  node: TreeNode,
  sessionsByTaskId: ReadonlyMap<string, TaskAgentSession[]> = new Map(),
  // Only used by the narrow-container width regression test below; every
  // other caller renders at the default (unconstrained) width.
  wrapperClassName?: string,
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const rootRoute = createRootRoute({
    validateSearch: (search: Record<string, unknown>) => search,
    component: () => {
      const harness = (
        <TreeHarness node={node} sessionsByTaskId={sessionsByTaskId} />
      )
      return wrapperClassName != null ? (
        <div className={wrapperClassName}>{harness}</div>
      ) : (
        harness
      )
    },
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

  it('renders only the desktop row-actions trigger', async () => {
    const { container } = await renderTree(makeNode())
    expect(
      [...container.querySelectorAll('[aria-label="Task actions"]')].map(
        (trigger) => trigger.getAttribute('data-slot'),
      ),
    ).toEqual(['dropdown-menu-trigger'])
  })

  it('does not render a mobile row-actions trigger', async () => {
    await page.viewport(MOBILE_VIEWPORT.width, MOBILE_VIEWPORT.height)
    const { container } = await renderTree(makeNode())
    expect(
      container.querySelector('[data-slot="action-sheet-trigger"]'),
    ).toEqual(null)
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
    const session: TaskAgentSession = makeTaskAgentSession({
      id: 'session-1',
      taskId: 'parent-1',
      taskTitle: 'Parent task',
      sessionId: 'sess-1',
      cwd: '/home/fohte/project',
      label: 'Fix bug',
      lastActiveAt: new Date().toISOString(),
    })
    await renderTree(node, new Map([['parent-1', [session]]]))

    expect(screen.queryByLabelText('Collapse')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Expand')).not.toBeInTheDocument()
  })

  it('shows a session indicator for a task with sessions', async () => {
    const node = makeNode({ id: 'parent-1', children: [] })
    const session: TaskAgentSession = makeTaskAgentSession({
      id: 'session-1',
      taskId: 'parent-1',
      taskTitle: 'Parent task',
      sessionId: 'sess-1',
      cwd: '/home/fohte/project',
      label: 'Fix bug',
      lastActiveAt: new Date().toISOString(),
    })
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
      githubLinks: [makeGithubLink({ title: 'Linked issue' })],
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
    const link = screen.getByRole('link')
    // The draggable row's accessible name also starts with "#".
    expect(
      within(link).queryByRole('button', { name: /^#/ }),
    ).not.toBeInTheDocument()
  })

  it('renders a token per label', async () => {
    await renderTree(makeNode({ labels: ['dev:tq', 'chore'] }))
    expect(
      within(screen.getByRole('link'))
        .getAllByRole('button', { name: /^#/ })
        .map((el) => el.textContent),
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

  it('keeps the title from collapsing to 0 width in a narrow container', async () => {
    // Keep a 64px minimum width so the title remains visible in a narrow row.
    await renderTree(
      makeNode({ title: 'Todo task (personal)' }),
      new Map(),
      'w-xl',
    )

    expect(
      screen.getByText('Todo task (personal)').getBoundingClientRect().width,
    ).toBeGreaterThan(0)
  })

  it('hides the desktop actions trigger by default and reveals it on focus', async () => {
    const { container } = await renderTree(makeNode())
    const trigger = assertDefined(
      container.querySelector<HTMLElement>(
        '[data-slot="dropdown-menu-trigger"][aria-label="Task actions"]',
      ),
      'desktop trigger not found',
    )

    // opacity-0 by default (from hideDesktopTriggerUntilHover on
    // TreeRowActionsMenu); revealed via `.group:hover` or its own
    // `:focus-visible`.
    expect(trigger).not.toBeVisible()

    trigger.focus()
    expect(trigger).toBeVisible()
  })

  it('reveals the desktop actions trigger when the row is hovered', async () => {
    const { container } = await renderTree(makeNode())
    const trigger = assertDefined(
      container.querySelector<HTMLElement>(
        '[data-slot="dropdown-menu-trigger"][aria-label="Task actions"]',
      ),
      'desktop trigger not found',
    )
    const row = assertDefined(
      trigger.closest<HTMLElement>('.group'),
      'task row not found',
    )

    await page.elementLocator(row).hover()

    expect(getComputedStyle(trigger).opacity).toBe('1')
  })
})
