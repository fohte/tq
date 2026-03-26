/* eslint-disable @typescript-eslint/no-unsafe-type-assertion, @typescript-eslint/no-non-null-assertion */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Import after mocks
import { Route } from '@web/routes/tasks/$taskId'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockTask = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  title: 'Test task title',
  description: 'Some **markdown** description',
  status: 'todo' as const,
  context: 'personal' as const,
  startDate: '2026-03-20',
  dueDate: '2026-03-25',
  estimatedMinutes: 90,
  parentId: null,
  projectId: null,
  sortOrder: 0,
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
  activeTimeBlockStartTime: null,
  childCompletionCount: { completed: 0, total: 0 },
  timeBlocks: [],
}

const mockUseTask = vi.fn()
const mockUpdateMutate = vi.fn()
const mockStatusMutate = vi.fn()

const mockParentMutate = vi.fn()

vi.mock('@web/hooks/use-tasks', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- mock delegation
  useTask: (...args: unknown[]) => mockUseTask(...args),
  useUpdateTask: () => ({ mutate: mockUpdateMutate }),
  useUpdateTaskStatus: () => ({ mutate: mockStatusMutate }),
  useTaskList: () => ({ categorized: { all: [] } }),
  useUpdateTaskParent: () => ({ mutate: mockParentMutate }),
}))

vi.mock('@web/components/ui/markdown-editor', () => ({
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
      ...props
    }: { children: React.ReactNode } & Record<string, unknown>) => (
      <a href={typeof props['to'] === 'string' ? props['to'] : '#'}>
        {children}
      </a>
    ),
  }
})

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

  it('renders breadcrumb with task short ID', () => {
    mockUseTask.mockReturnValue({
      data: mockTask,
      isLoading: false,
      error: null,
    })
    renderTaskPage()
    expect(screen.getAllByText('Tasks').length).toBeGreaterThan(0)
    expect(screen.getAllByText('#550e8400').length).toBeGreaterThan(0)
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
      (e) => (e as HTMLTextAreaElement).defaultValue === mockTask.description,
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
    expect(screen.getAllByText('Status').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('Estimate').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('Context').length).toBeGreaterThanOrEqual(2)
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
    await user.click(titleButtons[0]!)

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
})
