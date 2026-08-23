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

const mockUseFilteredTaskTree = vi.fn()

vi.mock('#hooks/use-filtered-tasks', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- mock delegation
  useFilteredTaskTree: (...args: unknown[]) => mockUseFilteredTaskTree(...args),
}))

// The project filter select fetches the project list via useProjects. Stub
// it so the route never issues a real fetch.
const mockUseProjects = vi.fn()

vi.mock('#hooks/use-projects', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#hooks/use-projects')>()
  return {
    ...actual,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- mock delegation
    useProjects: (...args: unknown[]) => mockUseProjects(...args),
  }
})

// GithubIssueLinkModal (always mounted, just closed) calls useNavigate
// unconditionally, so a real router is required rather than a mocked one.
// TaskList itself is bound to the real TasksRoute (Route.useSearch() /
// Route.useNavigate()), so that route must be matched for real rather than
// rendered directly as a child element.
function renderTaskList(initialEntry = '/tasks') {
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
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  })

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
  mockUseFilteredTaskTree.mockReturnValue({
    isLoading: false,
    tree: [],
    tasks: [],
  })
  mockUseProjects.mockReturnValue({ data: [] })
})

// FilterMenu picks the popover container in jsdom (test-setup.ts's
// matchMedia mock defaults to desktop).
async function openFilterMenu(user: ReturnType<typeof userEvent.setup>) {
  const trigger = await screen.findByRole('button', { name: '+ filter' })
  await user.click(trigger)
  // The popup mounts after an async Floating UI position computation, so
  // wait for an item inside it rather than assuming it's mounted
  // synchronously once the click resolves.
  await screen.findByRole('checkbox', { name: 'show completed' })
}

describe('TaskList sort selector', () => {
  it('defaults to "updated" and requests updated-sorted data on initial render', async () => {
    renderTaskList()

    await waitFor(() => {
      expect(screen.getByText('sort: Updated')).toBeInTheDocument()
    })
    expect(mockUseFilteredTaskTree.mock.calls[0]).toEqual([
      { q: 'is:todo is:in_progress sort:updated' },
    ])
  })

  it('re-requests created-sorted data once "Created" is selected', async () => {
    const user = userEvent.setup()
    renderTaskList()

    await openFilterMenu(user)
    await user.click(screen.getByRole('button', { name: 'Created' }))

    expect(screen.getByText('sort: Created')).toBeInTheDocument()
    expect(mockUseFilteredTaskTree.mock.calls.at(-1)).toEqual([
      { q: 'is:todo is:in_progress sort:created' },
    ])
  })
})

describe('TaskList "show completed" toggle', () => {
  it('defaults to unchecked, hiding completed tasks', async () => {
    const user = userEvent.setup()
    renderTaskList()

    await openFilterMenu(user)
    expect(
      screen.getByRole('checkbox', { name: 'show completed' }),
    ).toHaveAttribute('aria-checked', 'false')
  })

  it('requests completed tasks once checked', async () => {
    const user = userEvent.setup()
    renderTaskList()

    await openFilterMenu(user)
    await user.click(screen.getByRole('checkbox', { name: 'show completed' }))

    expect(
      screen.getByRole('checkbox', { name: 'show completed' }),
    ).toHaveAttribute('aria-checked', 'true')
    expect(mockUseFilteredTaskTree.mock.calls.at(-1)).toEqual([
      { q: 'sort:updated' },
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

  it('defaults to no project chip and requests unfiltered data on initial render', async () => {
    renderTaskList()

    await waitFor(() => {
      expect(screen.getByText('sort: Updated')).toBeInTheDocument()
    })
    expect(screen.queryByText(/^project:/)).not.toBeInTheDocument()
    expect(mockUseFilteredTaskTree.mock.calls[0]).toEqual([
      { q: 'is:todo is:in_progress sort:updated' },
    ])
  })

  it('re-requests data scoped to the selected project', async () => {
    const user = userEvent.setup()
    renderTaskList()

    await openFilterMenu(user)
    await user.click(screen.getByRole('button', { name: 'Website Redesign' }))

    expect(
      screen.getByRole('button', { name: 'project: Website Redesign ×' }),
    ).toBeInTheDocument()
    expect(mockUseFilteredTaskTree.mock.calls.at(-1)).toEqual([
      { q: 'is:todo is:in_progress project:proj-1 sort:updated' },
    ])
  })
})

describe('TaskList tag filter', () => {
  it('shows no tag chip and requests unscoped data by default', async () => {
    renderTaskList()

    await waitFor(() => {
      expect(screen.getByText('sort: Updated')).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: /^#/ })).not.toBeInTheDocument()
    expect(mockUseFilteredTaskTree.mock.calls[0]).toEqual([
      { q: 'is:todo is:in_progress sort:updated' },
    ])
  })

  it('shows the tag chip and requests data scoped to the tag from a label: query', async () => {
    renderTaskList(
      '/tasks?q=is%3Atodo%20is%3Ain_progress%20sort%3Aupdated%20label%3Adev%3Atq',
    )

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: '#dev:tq ×' }),
      ).toBeInTheDocument()
    })
    expect(mockUseFilteredTaskTree.mock.calls[0]).toEqual([
      { q: 'is:todo is:in_progress sort:updated label:dev:tq' },
    ])
  })

  it('removes the tag from the q param when the tag chip is removed', async () => {
    const user = userEvent.setup()
    const { router } = renderTaskList(
      '/tasks?q=is%3Atodo%20is%3Ain_progress%20sort%3Aupdated%20label%3Adev%3Atq',
    )

    await user.click(await screen.findByRole('button', { name: '#dev:tq ×' }))

    // Removing the tag brings q back to the exact default
    // (is:todo is:in_progress sort:updated), which stripSearchParams
    // drops from the URL entirely.
    expect(router.state.location.search).toEqual({})
  })
})

describe('TaskList URL query encoding', () => {
  it('drops the q param entirely when every filter is at its default', async () => {
    const { router } = renderTaskList()

    await waitFor(() => {
      expect(screen.getByText('sort: Updated')).toBeInTheDocument()
    })
    expect(router.state.location.search).toEqual({})
  })

  it('encodes the selected sort into the q param', async () => {
    const user = userEvent.setup()
    const { router } = renderTaskList()

    await openFilterMenu(user)
    await user.click(screen.getByRole('button', { name: 'Created' }))

    expect(router.state.location.search).toEqual({
      q: 'is:todo is:in_progress sort:created',
    })
  })

  it('drops the is: tokens from the q param once "show completed" is checked', async () => {
    const user = userEvent.setup()
    const { router } = renderTaskList()

    await openFilterMenu(user)
    await user.click(screen.getByRole('checkbox', { name: 'show completed' }))

    expect(router.state.location.search).toEqual({ q: 'sort:updated' })
  })

  it('encodes the selected project into the q param', async () => {
    const user = userEvent.setup()
    mockUseProjects.mockReturnValue({
      data: [{ id: 'proj-1', title: 'Website Redesign' }],
    })
    const { router } = renderTaskList()

    await openFilterMenu(user)
    await user.click(screen.getByRole('button', { name: 'Website Redesign' }))

    expect(router.state.location.search).toEqual({
      q: 'is:todo is:in_progress project:proj-1 sort:updated',
    })
  })

  it('migrates a pre-migration sortBy/showCompleted/projectId URL into q', async () => {
    mockUseProjects.mockReturnValue({
      data: [{ id: 'proj-1', title: 'Website Redesign' }],
    })
    const user = userEvent.setup()
    // Asserts against the rendered filter state (not router.state.location
    // .search): TanStack Router only re-derives `location.search` from
    // validateSearch's `q` on the next navigate, so on this initial load the
    // address bar still shows the raw legacy params even though the
    // component itself already reads the migrated, correctly-filtered state.
    renderTaskList('/tasks?sortBy=created&showCompleted=true&projectId=proj-1')

    await waitFor(() => {
      expect(screen.getByText('sort: Created')).toBeInTheDocument()
    })
    expect(
      screen.getByRole('button', { name: 'project: Website Redesign ×' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('not completed ×')).not.toBeInTheDocument()

    await openFilterMenu(user)
    expect(
      screen.getByRole('checkbox', { name: 'show completed' }),
    ).toHaveAttribute('aria-checked', 'true')
  })

  it('keeps a token none of the filter pickers understand when a known field changes', async () => {
    const user = userEvent.setup()
    const { router } = renderTaskList(
      '/tasks?q=is%3Atodo%20is%3Ain_progress%20sort%3Aupdated%20has%3Apages',
    )

    await openFilterMenu(user)
    await user.click(screen.getByRole('button', { name: 'Created' }))

    expect(router.state.location.search).toEqual({
      q: 'is:todo is:in_progress has:pages sort:created',
    })
  })

  it('migrates a pre-migration ?tag= URL into q', async () => {
    renderTaskList('/tasks?tag=urgent')

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: '#urgent ×' }),
      ).toBeInTheDocument()
    })
    expect(mockUseFilteredTaskTree.mock.calls[0]).toEqual([
      { q: 'is:todo is:in_progress label:urgent sort:updated' },
    ])
  })
})
