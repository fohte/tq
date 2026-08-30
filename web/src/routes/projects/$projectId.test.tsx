import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { assertDefined, atIndex } from '#lib/test-utils'
// Import after mocks
import { Route as ProjectDetailRoute } from '#routes/projects/$projectId'

const mockProject = {
  id: 'p1',
  title: 'ISUCON14',
  description: 'Some **markdown** description',
  status: 'active' as const,
  startDate: '2024-11-04',
  targetDate: '2024-12-08',
  color: '#FF8400',
  sortOrder: 0,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  taskCount: { total: 5, todo: 2, inProgress: 1, completed: 2 },
  completionRate: 0.4,
}

const baseTask = {
  description: null,
  context: 'personal' as const,
  labels: [],
  startDate: null,
  dueDate: null,
  estimatedMinutes: null,
  parentId: null,
  projectId: 'p1',
  recurrenceRuleId: null,
  recurrenceRule: null,
  githubLinks: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  childCompletionCount: { completed: 0, total: 0 },
}

const mockUseProject = vi.fn()
const mockUseProjectTaskIds = vi.fn()
const mockUseProjects = vi.fn()
const mockUpdateMutate = vi.fn()
const mockUseFilteredTaskTree = vi.fn()

vi.mock('#hooks/use-projects', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#hooks/use-projects')>()
  return {
    ...actual,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- mock delegation
    useProject: (...args: unknown[]) => mockUseProject(...args),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- mock delegation
    useProjectTaskIds: (...args: unknown[]) => mockUseProjectTaskIds(...args),
    useUpdateProject: () => ({ mutate: mockUpdateMutate }),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- mock delegation
    useProjects: (...args: unknown[]) => mockUseProjects(...args),
  }
})

vi.mock('#hooks/use-filtered-tasks', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- mock delegation
  useFilteredTaskTree: (...args: unknown[]) => mockUseFilteredTaskTree(...args),
}))

vi.mock('#components/ui/markdown-editor', () => ({
  MarkdownEditor: ({
    placeholder,
    onChange,
    defaultValue,
  }: {
    placeholder?: string
    onChange?: (md: string) => void
    defaultValue?: string
  }) => (
    <textarea
      data-testid="mock-markdown-editor"
      placeholder={placeholder}
      defaultValue={defaultValue}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
}))

// Route params come from matching the real ProjectDetailRoute for real
// (rather than stubbing @tanstack/react-router), because the task-list
// filter chips rely on useSearch()/useNavigate() from the real router.
// A fresh router (re-loaded) is built for both the initial render and every
// rerender — TanStack Router memoizes matched-route rendering on unchanged
// router state, so reusing one router across rerenders would keep stale
// mock data on screen (see today.test.tsx for the same pattern).
async function buildProjectDetailTree(
  queryClient: QueryClient,
  initialEntry: string,
) {
  const rootRoute = createRootRoute({
    validateSearch: (search: Record<string, unknown>) => search,
  })
  // A file route's id/path/parent are normally wired up by the generated
  // routeTree.gen.ts (via this same `.update()` call, cast the same way) —
  // reproduce that here so the real ProjectDetailRoute (with its real
  // validateSearch/stripSearchParams config) can be matched against a
  // locally-built tree instead of the app's real root.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-type-assertion -- mirrors routeTree.gen.ts's own `as any` for wiring a file route into a route tree
  ProjectDetailRoute.update({
    id: '/projects/$projectId',
    path: '/projects/$projectId',
    getParentRoute: () => rootRoute,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mirrors routeTree.gen.ts's own `as any` for wiring a file route into a route tree
  } as any)
  const projectsIndexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/projects',
    component: () => null,
  })
  const taskDetailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/tasks/$taskId',
    component: () => null,
  })
  rootRoute.addChildren([
    ProjectDetailRoute,
    projectsIndexRoute,
    taskDetailRoute,
  ])
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  })
  // The router's first route match resolves asynchronously even with no
  // loaders, so router.load() is awaited before render() to avoid an initial
  // blank paint.
  await router.load()
  return {
    router,
    element: (
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    ),
  }
}

async function renderProjectDetailPage(initialEntry = '/projects/p1') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const { router, element } = await buildProjectDetailTree(
    queryClient,
    initialEntry,
  )
  const utils = render(element)
  return {
    ...utils,
    router,
    rerenderAt: async (next: string) => {
      const built = await buildProjectDetailTree(queryClient, next)
      utils.rerender(built.element)
      return built.router
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2024-11-15T09:00:00'))
  mockUseProject.mockReturnValue({
    data: mockProject,
    isLoading: false,
    error: null,
  })
  mockUseProjectTaskIds.mockReturnValue({ data: [] })
  mockUseProjects.mockReturnValue({ data: [] })
  mockUseFilteredTaskTree.mockReturnValue({
    isLoading: false,
    tree: [],
    tasks: [],
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ProjectDetailPage', () => {
  it('shows loading state', async () => {
    mockUseProject.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    })
    await renderProjectDetailPage()
    expect(document.querySelector('.animate-spin')).toBeTruthy()
  })

  it('shows not-found state when the project request errors', async () => {
    mockUseProject.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Not found'),
    })
    await renderProjectDetailPage()
    expect(screen.getByText('Project not found')).toBeInTheDocument()
  })

  it('renders breadcrumb and title once per layout (PC + SP)', async () => {
    await renderProjectDetailPage()
    // breadcrumb "projects" link, per layout (PC + SP)
    expect(screen.getAllByText('projects')).toHaveLength(2)
    // SP back-nav "Projects" link
    expect(screen.getAllByText('Projects')).toHaveLength(1)
    // breadcrumb leaf, once per layout (PC + SP) — scoped to each <nav> so
    // this stays unaffected by unrelated "ISUCON14" text elsewhere on the
    // page.
    const breadcrumbNavs = screen.getAllByRole('navigation')
    expect(breadcrumbNavs).toHaveLength(2)
    for (const nav of breadcrumbNavs) {
      expect(within(nav).getByText('ISUCON14')).toBeInTheDocument()
    }
    // editable title button, once per layout (PC + SP)
    expect(screen.getAllByRole('button', { name: 'ISUCON14' })).toHaveLength(2)
  })

  it('renders description editor with project description', async () => {
    await renderProjectDetailPage()
    const editors = screen.getAllByTestId('mock-markdown-editor')
    const editorWithDescription = editors.find(
      (e) =>
        e instanceof HTMLTextAreaElement &&
        e.defaultValue === mockProject.description,
    )
    expect(editorWithDescription).toBeTruthy()
  })

  it('saves the description after the debounce delay', async () => {
    await renderProjectDetailPage()

    const editors = screen.getAllByTestId('mock-markdown-editor')
    const editor = assertDefined(
      editors.find(
        (e) =>
          e instanceof HTMLTextAreaElement &&
          e.defaultValue === mockProject.description,
      ),
    )
    fireEvent.change(editor, { target: { value: 'Updated description' } })
    vi.advanceTimersByTime(1000)

    expect(mockUpdateMutate).toHaveBeenCalledWith({
      id: mockProject.id,
      input: { description: 'Updated description' },
    })
  })

  it('renders task progress summary once per layout (PC + SP)', async () => {
    await renderProjectDetailPage()
    expect(screen.getAllByText(/2\/5 completed/)).toHaveLength(2)
    expect(screen.getAllByText(/\(40%\)/)).toHaveLength(2)
  })

  it('renders status breakdown counts once per layout (PC + SP)', async () => {
    await renderProjectDetailPage()
    expect(screen.getAllByText('Todo: 2')).toHaveLength(2)
    expect(screen.getAllByText('In Progress: 1')).toHaveLength(2)
    expect(screen.getAllByText('Completed: 2')).toHaveLength(2)
  })

  it('opens the link existing task menu when the link button is clicked', async () => {
    await renderProjectDetailPage()
    vi.useRealTimers()
    const user = userEvent.setup()

    const linkButtons = screen.getAllByLabelText('Link existing task')
    expect(linkButtons).toHaveLength(2)

    await user.click(atIndex(linkButtons, 0))

    expect(screen.getAllByText('Type to search tasks').length).toBeGreaterThan(
      0,
    )
  })

  it('renders sidebar field labels once per layout (PC + SP)', async () => {
    await renderProjectDetailPage()
    expect(screen.getAllByText('STATUS')).toHaveLength(2)
    expect(screen.getAllByText('START DATE')).toHaveLength(2)
    expect(screen.getAllByText('TARGET DATE')).toHaveLength(2)
    expect(screen.getAllByText('COLOR')).toHaveLength(2)
  })

  it('renders remaining days based on the target date once per layout (PC + SP)', async () => {
    await renderProjectDetailPage()
    expect(screen.getAllByText('23 days remaining')).toHaveLength(2)
    expect(screen.getAllByText(/Target: Dec 8, 2024/)).toHaveLength(2)
  })

  it('does not render remaining days when target date is not set', async () => {
    mockUseProject.mockReturnValue({
      data: { ...mockProject, targetDate: null },
      isLoading: false,
      error: null,
    })
    await renderProjectDetailPage()
    expect(screen.queryByText(/days remaining/)).not.toBeInTheDocument()
  })

  it('allows inline title editing', async () => {
    await renderProjectDetailPage()
    vi.useRealTimers()
    const user = userEvent.setup()

    const titleButtons = screen.getAllByRole('button', { name: 'ISUCON14' })
    await user.click(atIndex(titleButtons, 0))

    const input = screen.getByDisplayValue('ISUCON14')
    expect(input).toBeInTheDocument()

    await user.clear(input)
    await user.type(input, 'Updated title')
    await user.keyboard('{Enter}')

    expect(mockUpdateMutate).toHaveBeenCalledWith({
      id: mockProject.id,
      input: { title: 'Updated title' },
    })
  })

  it('does not swallow the next save after cancelling a title edit with Escape', async () => {
    await renderProjectDetailPage()
    vi.useRealTimers()
    const user = userEvent.setup()

    // Cancel a first edit with Escape without ever blurring the input,
    // simulating a browser that doesn't synchronously fire blur on unmount.
    const titleButtons = screen.getAllByRole('button', { name: 'ISUCON14' })
    await user.click(atIndex(titleButtons, 0))
    await user.keyboard('{Escape}')

    const titleButtonsAfterCancel = screen.getAllByRole('button', {
      name: 'ISUCON14',
    })
    await user.click(atIndex(titleButtonsAfterCancel, 0))
    const input = screen.getByDisplayValue('ISUCON14')
    await user.clear(input)
    await user.type(input, 'Updated title')
    await user.keyboard('{Enter}')

    expect(mockUpdateMutate).toHaveBeenCalledWith({
      id: mockProject.id,
      input: { title: 'Updated title' },
    })
  })

  it('updates status via the sidebar select', async () => {
    await renderProjectDetailPage()
    vi.useRealTimers()
    const user = userEvent.setup()

    const statusSelects = screen.getAllByDisplayValue('Active')
    await user.selectOptions(atIndex(statusSelects, 0), 'paused')

    expect(mockUpdateMutate).toHaveBeenCalledWith({
      id: mockProject.id,
      input: { status: 'paused' },
    })
  })

  it('updates the target date via the sidebar date input', async () => {
    await renderProjectDetailPage()

    const dateInputs = screen.getAllByDisplayValue('2024-12-08')
    fireEvent.change(atIndex(dateInputs, 0), {
      target: { value: '2024-12-31' },
    })

    expect(mockUpdateMutate).toHaveBeenCalledWith({
      id: mockProject.id,
      input: { targetDate: '2024-12-31' },
    })
  })

  it('updates the color via the sidebar swatches', async () => {
    await renderProjectDetailPage()
    vi.useRealTimers()
    const user = userEvent.setup()

    const greenSwatches = screen.getAllByTitle('Green')
    await user.click(atIndex(greenSwatches, 0))

    expect(mockUpdateMutate).toHaveBeenCalledWith({
      id: mockProject.id,
      input: { color: '#4CAF50' },
    })
  })

  it('remounts the description editor in both layouts when switching to a different project', async () => {
    const { rerenderAt } = await renderProjectDetailPage()

    const editorsBefore = screen.getAllByTestId('mock-markdown-editor')

    mockUseProject.mockReturnValue({
      data: {
        ...mockProject,
        id: 'p2',
        description: 'A different description',
      },
      isLoading: false,
      error: null,
    })
    await rerenderAt('/projects/p2')

    const editorsAfter = screen.getAllByTestId('mock-markdown-editor')
    expect(editorsAfter).toHaveLength(editorsBefore.length)
    editorsAfter.forEach((editor, i) => {
      expect(editor).not.toBe(editorsBefore[i])
    })
  })
})

describe('ProjectDetailPage task list', () => {
  it('scopes the initial fetch to q plus a separate projectId param', async () => {
    await renderProjectDetailPage()

    expect(mockUseFilteredTaskTree.mock.calls[0]).toEqual([
      { q: 'is:todo is:in_progress sort:updated', projectId: 'p1' },
    ])
  })

  it('hides the Save view button', async () => {
    await renderProjectDetailPage()

    expect(
      screen.queryByRole('button', { name: 'Save view' }),
    ).not.toBeInTheDocument()
  })

  it('hides the project filter chip even when q embeds a conflicting project scope', async () => {
    // Without disableProjectFilter, this project would resolve to a visible
    // chip — proves the route's guard, not just an empty projects list,
    // suppresses it.
    mockUseProjects.mockReturnValue({
      data: [
        {
          id: 'other-project',
          title: 'Other Project',
          description: null,
          status: 'active' as const,
          startDate: null,
          targetDate: null,
          color: null,
          sortOrder: 0,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          taskCount: { total: 0, completed: 0 },
          completionRate: 0,
        },
      ],
    })

    await renderProjectDetailPage(
      '/projects/p1?q=' +
        encodeURIComponent('project:other-project sort:updated'),
    )

    expect(
      screen.queryByRole('button', { name: /^project / }),
    ).not.toBeInTheDocument()
  })

  it('updates the q search param in the URL when sort changes', async () => {
    const user = userEvent.setup()
    const { router } = await renderProjectDetailPage()
    vi.useRealTimers()

    await user.click(
      atIndex(screen.getAllByRole('button', { name: /Sort by/ }), 0),
    )
    await user.click(await screen.findByRole('button', { name: 'Created' }))

    expect(router.state.location.search).toEqual({
      q: 'is:todo is:in_progress sort:created',
    })
  })

  it('re-requests filtered data scoped to the project after a sort change', async () => {
    const user = userEvent.setup()
    await renderProjectDetailPage()
    vi.useRealTimers()

    await user.click(
      atIndex(screen.getAllByRole('button', { name: /Sort by/ }), 0),
    )
    await user.click(await screen.findByRole('button', { name: 'Created' }))

    expect(mockUseFilteredTaskTree.mock.calls.at(-1)).toEqual([
      { q: 'is:todo is:in_progress sort:created', projectId: 'p1' },
    ])
  })

  it('renders TaskTreeList from the filtered tree/tasks props', async () => {
    const filteredTask = {
      ...baseTask,
      id: 'f1',
      title: 'Filtered task',
      status: 'todo' as const,
    }
    mockUseFilteredTaskTree.mockReturnValue({
      isLoading: false,
      tree: [{ ...filteredTask, children: [] }],
      tasks: [filteredTask],
    })

    await renderProjectDetailPage()

    expect(screen.getAllByText('Filtered task').length).toBeGreaterThan(0)
  })

  it('opens the create task modal when "Add task" is clicked', async () => {
    await renderProjectDetailPage()
    vi.useRealTimers()
    const user = userEvent.setup()

    await user.click(atIndex(screen.getAllByLabelText('Add task'), 0))

    expect(screen.getAllByText('New Task').length).toBeGreaterThan(0)
  })
})
