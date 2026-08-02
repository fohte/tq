import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { atIndex } from '#lib/test-utils'
// Import after mocks
import { Route } from '#routes/tasks/$taskId'

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
  sortOrder: 0,
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
  childCompletionCount: { completed: 0, total: 0 },
  timeBlocks: [],
  links: { outgoing: [], incoming: [] },
}

const mockUseTask = vi.fn()
const mockUseTaskList = vi.fn()
const mockUpdateMutate = vi.fn()
const mockStatusMutate = vi.fn()

const mockParentMutate = vi.fn()

vi.mock('#hooks/use-tasks', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- mock delegation
  useTask: (...args: unknown[]) => mockUseTask(...args),
  useUpdateTask: () => ({ mutate: mockUpdateMutate }),
  useUpdateTaskStatus: () => ({ mutate: mockStatusMutate }),
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- mock delegation
  useTaskList: (...args: unknown[]) => mockUseTaskList(...args),
  useUpdateTaskParent: () => ({ mutate: mockParentMutate }),
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

// The mock needs to return an object that has useParams on it and also acts as a function
vi.mock('@tanstack/react-router', () => {
  // createFileRoute returns a function, which when called with { component } returns Route
  // Route must have .useParams()
  return {
    createFileRoute: () => {
      const route = Object.assign(
        (opts: { component: React.ComponentType }) => {
          return Object.assign(
            {},
            {
              component: opts.component,
              useParams: () => ({
                taskId: '550e8400-e29b-41d4-a716-446655440000',
              }),
            },
          )
        },
        {
          useParams: () => ({
            taskId: '550e8400-e29b-41d4-a716-446655440000',
          }),
        },
      )

      return route
    },
    Link: ({
      children,
      to,
      params,
      className,
    }: {
      children: React.ReactNode
      to?: string
      params?: Record<string, string>
      className?: string
    }) => {
      const href = Object.entries(params ?? {}).reduce(
        (acc, [key, value]) => acc.replace(`$${key}`, value),
        typeof to === 'string' ? to : '#',
      )
      return (
        <a href={href} className={className}>
          {children}
        </a>
      )
    },
    useNavigate: () => vi.fn(),
  }
})

// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- extracting component from mocked Route object
const TaskPage = (Route as unknown as { component: React.ComponentType })
  .component

function renderTaskPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <TaskPage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseTaskList.mockReturnValue({ categorized: { all: [] } })
})

describe('TaskPage', () => {
  it('shows loading state', () => {
    mockUseTask.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    })
    renderTaskPage()
    expect(document.querySelector('.animate-spin')).toBeTruthy()
  })

  it('shows error state when task not found', () => {
    mockUseTask.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Not found'),
    })
    renderTaskPage()
    expect(screen.getByText('Task not found')).toBeInTheDocument()
  })

  it('renders task title', () => {
    mockUseTask.mockReturnValue({
      data: mockTask,
      isLoading: false,
      error: null,
    })
    renderTaskPage()
    expect(screen.getAllByText('Test task title').length).toBeGreaterThan(0)
  })

  it('renders breadcrumb with task number', () => {
    mockUseTask.mockReturnValue({
      data: mockTask,
      isLoading: false,
      error: null,
    })
    renderTaskPage()
    expect(screen.getAllByText('tasks').length).toBeGreaterThan(0)
    expect(screen.getAllByText('#42').length).toBeGreaterThan(0)
  })

  it('renders description editor with task description', () => {
    mockUseTask.mockReturnValue({
      data: mockTask,
      isLoading: false,
      error: null,
    })
    renderTaskPage()
    const editors = screen.getAllByTestId('mock-markdown-editor')
    const editorWithDescription = editors.find(
      (e) =>
        e instanceof HTMLTextAreaElement &&
        e.defaultValue === mockTask.description,
    )
    expect(editorWithDescription).toBeTruthy()
  })

  it('renders sidebar fields', () => {
    mockUseTask.mockReturnValue({
      data: mockTask,
      isLoading: false,
      error: null,
    })
    renderTaskPage()
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
    renderTaskPage()
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

  it('renders estimate in sidebar', () => {
    mockUseTask.mockReturnValue({
      data: mockTask,
      isLoading: false,
      error: null,
    })
    renderTaskPage()
    expect(screen.getAllByText('1h30m').length).toBeGreaterThan(0)
  })

  it('renders subtasks and links to their detail pages', () => {
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
      sortOrder: 0,
      recurrenceRuleId: null,
      recurrenceRule: null,
      githubLink: null,
      createdAt: '2026-03-20T00:00:00.000Z',
      updatedAt: '2026-03-20T00:00:00.000Z',
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
        sortOrder: 1,
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

    renderTaskPage()

    expect(mockUseTaskList).toHaveBeenCalledWith({ parentId: mockTask.id })

    // PC and SP layouts both render TaskMainContent, so each subtask appears twice.
    const finishedLinks = screen.getAllByRole('link', {
      name: 'Finished subtask',
    })
    expect(finishedLinks.map((el) => el.getAttribute('href'))).toEqual([
      '/tasks/subtask-001',
      '/tasks/subtask-001',
    ])
    expect(atIndex(finishedLinks, 0)).toHaveClass('line-through')

    const pendingLinks = screen.getAllByRole('link', {
      name: 'Pending subtask',
    })
    expect(pendingLinks.map((el) => el.getAttribute('href'))).toEqual([
      '/tasks/subtask-002',
      '/tasks/subtask-002',
    ])
    expect(atIndex(pendingLinks, 0)).not.toHaveClass('line-through')

    expect(screen.getAllByText('1/2').length).toBeGreaterThan(0)
  })
})
