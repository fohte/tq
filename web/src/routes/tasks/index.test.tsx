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
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ContextFilterProvider } from '#hooks/use-context-filter'
import { TagFilterProvider } from '#hooks/use-tag-filter'
// Import after mocks
import { TaskList } from '#routes/tasks/index'

const mockUseFilteredTaskList = vi.fn()
const mockUseFilteredTaskTree = vi.fn()

vi.mock('#hooks/use-filtered-tasks', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- mock delegation
  useFilteredTaskList: (...args: unknown[]) => mockUseFilteredTaskList(...args),
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- mock delegation
  useFilteredTaskTree: (...args: unknown[]) => mockUseFilteredTaskTree(...args),
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
function Providers({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const rootRoute = createRootRoute({
    component: () => <>{children}</>,
  })
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => null,
  })
  const taskRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/tasks/$taskId',
    component: () => null,
  })
  rootRoute.addChildren([indexRoute, taskRoute])
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })

  return (
    <QueryClientProvider client={queryClient}>
      <ContextFilterProvider>
        <TagFilterProvider>
          <RouterProvider router={router} />
        </TagFilterProvider>
      </ContextFilterProvider>
    </QueryClientProvider>
  )
}

function renderTaskList() {
  return render(
    <Providers>
      <TaskList />
    </Providers>,
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
    expect(mockUseFilteredTaskList.mock.calls[0]).toEqual(['updated'])
    expect(mockUseFilteredTaskTree.mock.calls[0]).toEqual([
      { enabled: true, sortBy: 'updated' },
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
    expect(mockUseFilteredTaskList.mock.calls.at(-1)).toEqual(['created'])
    expect(mockUseFilteredTaskTree.mock.calls.at(-1)).toEqual([
      { enabled: true, sortBy: 'created' },
    ])
  })
})
