import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Import after mocks
import { Route as TasksRoute } from '#routes/tasks/index'

const mockUseFilteredTaskList = vi.fn()
const mockUseFilteredTaskTree = vi.fn()

vi.mock('#hooks/use-filtered-tasks', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- mock delegation
  useFilteredTaskList: (...args: unknown[]) => mockUseFilteredTaskList(...args),
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- mock delegation
  useFilteredTaskTree: (...args: unknown[]) => mockUseFilteredTaskTree(...args),
}))

// The project filter select fetches the project list via useProjects. Stub
// it so the route never issues a real fetch.
const mockUseProjects = vi.fn()

vi.mock('#hooks/use-projects', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- mock delegation
  useProjects: (...args: unknown[]) => mockUseProjects(...args),
}))

// TagFilterChips (rendered for real, not mocked below) reads tag counts via
// useTagCounts, which calls useTaskList from '#hooks/use-tasks' directly —
// independent of the useFilteredTaskList mock above. Stub it too so the
// route never issues a real fetch.
const mockUseTaskList = vi.fn()

vi.mock('#hooks/use-tasks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#hooks/use-tasks')>()
  return {
    ...actual,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- mock delegation
    useTaskList: (...args: unknown[]) => mockUseTaskList(...args),
  }
})

// GithubIssueLinkModal (always mounted, just closed) calls useNavigate
// unconditionally, so a real router is required rather than a mocked one.
// TaskList itself is bound to the real TasksRoute (Route.useSearch() /
// Route.useNavigate()), so that route must be matched for real rather than
// rendered directly as a child element.
function renderTaskList() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const rootRoute = createRootRoute({
    validateSearch: (search: Record<string, unknown>) => search,
  })
  // A file route's id/path/parent are normally wired up by the generated
  // routeTree.gen.ts (via this same `.update()` call, cast the same way) —
  // reproduce that here so the real TasksRoute (with its real
  // validateSearch/stripSearchParams config) can be matched against a
  // locally-built tree instead of the app's real root.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-type-assertion -- mirrors routeTree.gen.ts's own `as any` for wiring a file route into a route tree
  TasksRoute.update({
    id: '/tasks/',
    path: '/tasks/',
    getParentRoute: () => rootRoute,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mirrors routeTree.gen.ts's own `as any` for wiring a file route into a route tree
  } as any)
  const taskRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/tasks/$taskId',
    component: () => null,
  })
  rootRoute.addChildren([TasksRoute, taskRoute])
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/tasks'] }),
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseFilteredTaskList.mockReturnValue({
    isLoading: false,
    open: [],
    all: [],
    backlog: [],
    nonBacklog: [],
  })
  mockUseFilteredTaskTree.mockReturnValue({ isLoading: false, tree: [] })
  mockUseTaskList.mockReturnValue({
    categorized: { all: [], open: [], backlog: [], nonBacklog: [] },
    isLoading: false,
  })
  mockUseProjects.mockReturnValue({ data: [] })
})

describe('TaskList sort selector', () => {
  it('defaults to "updated" and requests updated-sorted data on initial render', async () => {
    renderTaskList()

    await waitFor(() => {
      expect(screen.getByLabelText('Sort tasks')).toHaveValue('updated')
    })
    // Two independent mocks, so each gets its own full-equality check rather
    // than being fused into one array (which `fohte/no-inline-object-in-expect`
    // forbids: it's for the same reason it disallows partial per-field checks
    // on a single output — bundling unrelated values back-defeats the point).
    expect(mockUseFilteredTaskList.mock.calls[0]).toEqual([
      { sortBy: 'updated', showCompleted: false },
    ])
    expect(mockUseFilteredTaskTree.mock.calls[0]).toEqual([
      { enabled: true, sortBy: 'updated', showCompleted: false },
    ])
  })

  it('re-requests created-sorted data once "Created" is selected', async () => {
    const user = userEvent.setup()
    renderTaskList()

    await waitFor(() => {
      expect(screen.getByLabelText('Sort tasks')).toBeInTheDocument()
    })
    await user.selectOptions(screen.getByLabelText('Sort tasks'), 'created')

    expect(screen.getByLabelText('Sort tasks')).toHaveValue('created')
    expect(mockUseFilteredTaskList.mock.calls.at(-1)).toEqual([
      { sortBy: 'created', showCompleted: false },
    ])
    expect(mockUseFilteredTaskTree.mock.calls.at(-1)).toEqual([
      { enabled: true, sortBy: 'created', showCompleted: false },
    ])
  })
})

describe('TaskList "show completed" toggle', () => {
  it('defaults to unchecked, hiding completed tasks', async () => {
    renderTaskList()

    await waitFor(() => {
      expect(
        screen.getByRole('checkbox', { name: 'show completed' }),
      ).not.toBeChecked()
    })
  })

  it('requests completed tasks once checked', async () => {
    const user = userEvent.setup()
    renderTaskList()

    await waitFor(() => {
      expect(
        screen.getByRole('checkbox', { name: 'show completed' }),
      ).toBeInTheDocument()
    })
    await user.click(screen.getByRole('checkbox', { name: 'show completed' }))

    expect(
      screen.getByRole('checkbox', { name: 'show completed' }),
    ).toBeChecked()
    expect(mockUseFilteredTaskList.mock.calls.at(-1)).toEqual([
      { sortBy: 'updated', showCompleted: true },
    ])
    expect(mockUseFilteredTaskTree.mock.calls.at(-1)).toEqual([
      { enabled: true, sortBy: 'updated', showCompleted: true },
    ])
  })
})

describe('TaskList project filter selector', () => {
  beforeEach(() => {
    mockUseProjects.mockReturnValue({
      data: [
        { id: 'proj-1', title: 'Website Redesign' },
        { id: 'proj-2', title: 'Mobile App' },
      ],
    })
  })

  it('defaults to "All projects" and requests unfiltered data on initial render', async () => {
    renderTaskList()

    await waitFor(() => {
      expect(screen.getByLabelText('Filter by project')).toHaveValue('')
    })
    expect(mockUseFilteredTaskList.mock.calls[0]).toEqual([
      { sortBy: 'updated', showCompleted: false },
    ])
    expect(mockUseFilteredTaskTree.mock.calls[0]).toEqual([
      { enabled: true, sortBy: 'updated', showCompleted: false },
    ])
  })

  it('re-requests data scoped to the selected project', async () => {
    const user = userEvent.setup()
    renderTaskList()

    await waitFor(() => {
      expect(screen.getByLabelText('Filter by project')).toBeInTheDocument()
    })
    await user.selectOptions(
      screen.getByLabelText('Filter by project'),
      'proj-1',
    )

    expect(screen.getByLabelText('Filter by project')).toHaveValue('proj-1')
    expect(mockUseFilteredTaskList.mock.calls.at(-1)).toEqual([
      { sortBy: 'updated', showCompleted: false, projectId: 'proj-1' },
    ])
    expect(mockUseFilteredTaskTree.mock.calls.at(-1)).toEqual([
      {
        enabled: true,
        sortBy: 'updated',
        showCompleted: false,
        projectId: 'proj-1',
      },
    ])
  })
})
