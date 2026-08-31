import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { atIndex } from '#lib/test-utils'
// Import after mocks
import { Route as TaskDetailRoute } from '#routes/tasks/$taskId'

const mockTask = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  number: 42,
  title: 'Test task title',
  description: 'Some **markdown** description',
  status: 'todo' as const,
  context: 'personal' as const,
  labels: [],
  startDate: '2026-03-20',
  dueDate: '2026-03-25',
  estimatedMinutes: 90,
  parentId: null,
  projectId: null,
  githubLinks: [],
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
  childCompletionCount: { completed: 0, total: 0 },
  timeBlocks: [],
  links: { outgoing: [], incoming: [] },
}

const otherMockTask = {
  ...mockTask,
  id: '660e8400-e29b-41d4-a716-446655440001',
  number: 99,
  title: 'Other task title',
  description: 'A completely different description',
}

const mockUseTask = vi.fn()
const mockUseTaskList = vi.fn()
const mockUpdateMutate = vi.fn()
const mockStatusMutate = vi.fn()
const mockCompleteMutate = vi.fn()

const mockParentMutate = vi.fn()

vi.mock('#hooks/use-tasks', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- mock delegation
  useTask: (...args: unknown[]) => mockUseTask(...args),
  useUpdateTask: () => ({ mutate: mockUpdateMutate }),
  useUpdateTaskStatus: () => ({ mutate: mockStatusMutate }),
  useCompleteTask: () => ({ mutate: mockCompleteMutate }),
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- mock delegation
  useTaskList: (...args: unknown[]) => mockUseTaskList(...args),
  useUpdateTaskParent: () => ({ mutate: mockParentMutate }),
  useDeleteTask: () => ({ mutate: vi.fn() }),
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

// Builds against the real TaskDetailRoute (not a stubbed router) so a test
// can call router.navigate()/router.history.back() on one router instance —
// see routes/projects/$projectId.test.tsx for the same pattern.
async function buildTaskDetailTree(
  queryClient: QueryClient,
  initialEntry: string,
) {
  const rootRoute = createRootRoute()
  // Wires TaskDetailRoute into this local tree the same way the generated
  // routeTree.gen.ts does.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-type-assertion -- mirrors routeTree.gen.ts's own `as any` for wiring a file route into a route tree
  TaskDetailRoute.update({
    id: '/tasks/$taskId',
    path: '/tasks/$taskId',
    getParentRoute: () => rootRoute,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mirrors routeTree.gen.ts's own `as any` for wiring a file route into a route tree
  } as any)
  const tasksIndexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/tasks',
    component: () => null,
  })
  rootRoute.addChildren([TaskDetailRoute, tasksIndexRoute])
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
    // Mirrors index.tsx's router config, since this test relies on the same
    // remount behavior.
    defaultRemountDeps: ({ params }) => params,
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

async function renderTaskPage(initialEntry = `/tasks/${mockTask.id}`) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const { router, element } = await buildTaskDetailTree(
    queryClient,
    initialEntry,
  )
  const utils = render(element)
  return { ...utils, router }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseTaskList.mockReturnValue({ categorized: { all: [] } })
})

describe('TaskPage', () => {
  it('shows loading state', async () => {
    mockUseTask.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    })
    await renderTaskPage()
    expect(document.querySelector('.animate-spin')).toBeTruthy()
  })

  it('shows error state when task not found', async () => {
    mockUseTask.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Not found'),
    })
    await renderTaskPage()
    expect(screen.getByText('Task not found')).toBeInTheDocument()
  })

  it('renders task title', async () => {
    mockUseTask.mockReturnValue({
      data: mockTask,
      isLoading: false,
      error: null,
    })
    await renderTaskPage()
    expect(screen.getAllByText('Test task title').length).toBeGreaterThan(0)
  })

  it('renders breadcrumb with task number', async () => {
    mockUseTask.mockReturnValue({
      data: mockTask,
      isLoading: false,
      error: null,
    })
    await renderTaskPage()
    expect(screen.getAllByText('tasks').length).toBeGreaterThan(0)
    expect(screen.getAllByText('#42').length).toBeGreaterThan(0)
  })

  it('renders description editor with task description', async () => {
    mockUseTask.mockReturnValue({
      data: mockTask,
      isLoading: false,
      error: null,
    })
    await renderTaskPage()
    const editors = screen.getAllByTestId('mock-markdown-editor')
    const editorWithDescription = editors.find(
      (e) =>
        e instanceof HTMLTextAreaElement &&
        e.defaultValue === mockTask.description,
    )
    expect(editorWithDescription).toBeTruthy()
  })

  it('renders sidebar fields', async () => {
    mockUseTask.mockReturnValue({
      data: mockTask,
      isLoading: false,
      error: null,
    })
    await renderTaskPage()
    expect(screen.getAllByText('STATUS').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('ESTIMATE').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('CONTEXT').length).toBeGreaterThanOrEqual(2)
  })

  it('allows inline title editing', async () => {
    mockUseTask.mockReturnValue({
      data: mockTask,
      isLoading: false,
      error: null,
    })
    await renderTaskPage()
    const user = userEvent.setup()

    const titleButtons = screen.getAllByText('Test task title')
    await user.click(atIndex(titleButtons, 0))

    const input = screen.getByDisplayValue('Test task title')
    expect(input).toBeInTheDocument()

    await user.clear(input)
    await user.type(input, 'Updated title')
    await user.keyboard('{Enter}')

    expect(mockUpdateMutate).toHaveBeenCalledWith({
      id: mockTask.id,
      input: { title: 'Updated title' },
    })
  })

  it('renders estimate in sidebar', async () => {
    mockUseTask.mockReturnValue({
      data: mockTask,
      isLoading: false,
      error: null,
    })
    await renderTaskPage()
    expect(screen.getAllByText('1h30m').length).toBeGreaterThan(0)
  })

  it('renders subtasks and links to their detail pages', async () => {
    const baseSubtask = {
      id: 'subtask-001',
      number: 43,
      title: 'Subtask',
      description: null,
      status: 'todo' as const,
      context: 'personal' as const,
      labels: [],
      startDate: null,
      dueDate: null,
      estimatedMinutes: null,
      parentId: mockTask.id,
      parentNumber: mockTask.number,
      projectId: null,
      recurrenceRuleId: null,
      recurrenceRule: null,
      githubLinks: [],
      createdAt: '2026-03-20T00:00:00.000Z',
      updatedAt: '2026-03-20T00:00:00.000Z',
      childCompletionCount: { completed: 0, total: 0 },
    }
    const subtasks = [
      {
        ...baseSubtask,
        id: 'subtask-001',
        title: 'Finished subtask',
        status: 'completed' as const,
      },
      {
        ...baseSubtask,
        id: 'subtask-002',
        number: 44,
        title: 'Pending subtask',
      },
    ]

    mockUseTask.mockReturnValue({
      data: { ...mockTask, childCompletionCount: { completed: 1, total: 2 } },
      isLoading: false,
      error: null,
    })
    mockUseTaskList.mockImplementation((filter?: { parentId?: string }) =>
      filter?.parentId === mockTask.id
        ? { categorized: { all: subtasks } }
        : { categorized: { all: [] } },
    )

    await renderTaskPage()

    expect(mockUseTaskList).toHaveBeenCalledWith({ parentId: mockTask.id })

    // PC and SP layouts both render TaskMainContent, so each subtask appears
    // twice. The row's title sits inside a larger `<Link>` alongside the
    // status picker and metadata, so match by text and walk up to the anchor.
    const finishedTitles = screen.getAllByText('Finished subtask')
    expect(
      finishedTitles.map((el) => el.closest('a')?.getAttribute('href')),
    ).toEqual(['/tasks/subtask-001', '/tasks/subtask-001'])
    expect(atIndex(finishedTitles, 0)).toHaveClass('line-through')

    const pendingTitles = screen.getAllByText('Pending subtask')
    expect(
      pendingTitles.map((el) => el.closest('a')?.getAttribute('href')),
    ).toEqual(['/tasks/subtask-002', '/tasks/subtask-002'])
    expect(atIndex(pendingTitles, 0)).not.toHaveClass('line-through')

    expect(screen.getAllByText('1/2').length).toBeGreaterThan(0)
  })

  it('remounts the description editor after navigating to a different task while both are cached', async () => {
    mockUseTask.mockImplementation((taskId: string) =>
      taskId === otherMockTask.id
        ? { data: otherMockTask, isLoading: false, error: null }
        : { data: mockTask, isLoading: false, error: null },
    )

    const { router } = await renderTaskPage(`/tasks/${mockTask.id}`)
    const editorsBefore = screen.getAllByTestId('mock-markdown-editor')

    // isLoading stays false for both tasks, matching a real navigation where
    // both are already cached by React Query.
    await act(async () => {
      await router.navigate({
        to: '/tasks/$taskId',
        params: { taskId: otherMockTask.id },
      })
    })

    expect(screen.getAllByText('Other task title').length).toBeGreaterThan(0)
    // The mock editor only reads its initial content once per mount (like
    // the real Crepe editor), so identity change is proof of a remount.
    const editorsAfter = screen.getAllByTestId('mock-markdown-editor')
    editorsAfter.forEach((editor, i) => {
      expect(editor).not.toBe(editorsBefore[i])
    })
  })

  it("shows the original task's description again after navigating back", async () => {
    mockUseTask.mockImplementation((taskId: string) =>
      taskId === otherMockTask.id
        ? { data: otherMockTask, isLoading: false, error: null }
        : { data: mockTask, isLoading: false, error: null },
    )

    const { router } = await renderTaskPage(`/tasks/${mockTask.id}`)
    await act(async () => {
      await router.navigate({
        to: '/tasks/$taskId',
        params: { taskId: otherMockTask.id },
      })
    })
    const editorsAtOther = screen.getAllByTestId('mock-markdown-editor')

    // router.history.back(), not router.navigate() again — TanStack Router
    // reuses the previous match when traversing history this way.
    act(() => {
      router.history.back()
    })

    expect(
      (await screen.findAllByText('Test task title')).length,
    ).toBeGreaterThan(0)
    const editorsAfter = screen.getAllByTestId('mock-markdown-editor')
    editorsAfter.forEach((editor, i) => {
      expect(editor).not.toBe(editorsAtOther[i])
    })
  })
})
