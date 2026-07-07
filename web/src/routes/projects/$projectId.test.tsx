import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { assertDefined, atIndex } from '@web/lib/test-utils'
// Import after mocks
import { Route } from '@web/routes/projects/$projectId'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
}

const baseTask = {
  description: null,
  context: 'personal' as const,
  startDate: null,
  dueDate: null,
  estimatedMinutes: null,
  parentId: null,
  projectId: 'p1',
  sortOrder: 0,
  recurrenceRuleId: null,
  recurrenceRule: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const mockTasks = [
  { ...baseTask, id: '1', title: 'Todo 1', status: 'todo' as const },
  { ...baseTask, id: '2', title: 'Todo 2', status: 'todo' as const },
  {
    ...baseTask,
    id: '3',
    title: 'In progress 1',
    status: 'in_progress' as const,
  },
  { ...baseTask, id: '4', title: 'Completed 1', status: 'completed' as const },
  { ...baseTask, id: '5', title: 'Completed 2', status: 'completed' as const },
]

const mockUseProject = vi.fn()
const mockUseProjectTasks = vi.fn()
const mockUpdateMutate = vi.fn()

vi.mock('@web/hooks/use-projects', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- mock delegation
  useProject: (...args: unknown[]) => mockUseProject(...args),
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- mock delegation
  useProjectTasks: (...args: unknown[]) => mockUseProjectTasks(...args),
  useUpdateProject: () => ({ mutate: mockUpdateMutate }),
  PROJECT_COLOR_PRESETS: [
    { name: 'Orange', hex: '#FF8400' },
    { name: 'Red', hex: '#FF5C33' },
    { name: 'Green', hex: '#4CAF50' },
    { name: 'Blue', hex: '#4A90D9' },
  ],
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

vi.mock('@tanstack/react-router', () => {
  return {
    createFileRoute: () => {
      const route = Object.assign(
        (opts: { component: React.ComponentType }) => {
          return Object.assign(
            {},
            {
              component: opts.component,
              useParams: () => ({ projectId: 'p1' }),
            },
          )
        },
        {
          useParams: () => ({ projectId: 'p1' }),
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

type RouteWithComponent = { component: React.ComponentType }
// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- extracting component from mocked Route object
const ProjectDetailPage = (Route as unknown as RouteWithComponent).component

function renderProjectDetailPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <ProjectDetailPage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2024-11-15T09:00:00'))
  mockUseProjectTasks.mockReturnValue({
    data: mockTasks,
    isLoading: false,
    error: null,
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ProjectDetailPage', () => {
  it('shows loading state', () => {
    mockUseProject.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    })
    renderProjectDetailPage()
    expect(document.querySelector('.animate-spin')).toBeTruthy()
  })

  it('shows not-found state when the project request errors', () => {
    mockUseProject.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Not found'),
    })
    renderProjectDetailPage()
    expect(screen.getByText('Project not found')).toBeInTheDocument()
  })

  it('renders breadcrumb and title once per layout (PC + SP)', () => {
    mockUseProject.mockReturnValue({
      data: mockProject,
      isLoading: false,
      error: null,
    })
    renderProjectDetailPage()
    // breadcrumb "Projects" link (PC + SP) + the SP back-nav "Projects" link
    expect(screen.getAllByText('Projects')).toHaveLength(3)
    // breadcrumb leaf + title button, per layout
    expect(screen.getAllByText('ISUCON14')).toHaveLength(4)
  })

  it('renders description editor with project description', () => {
    mockUseProject.mockReturnValue({
      data: mockProject,
      isLoading: false,
      error: null,
    })
    renderProjectDetailPage()
    const editors = screen.getAllByTestId('mock-markdown-editor')
    const editorWithDescription = editors.find(
      (e) =>
        e instanceof HTMLTextAreaElement &&
        e.defaultValue === mockProject.description,
    )
    expect(editorWithDescription).toBeTruthy()
  })

  it('saves the description after the debounce delay', () => {
    mockUseProject.mockReturnValue({
      data: mockProject,
      isLoading: false,
      error: null,
    })
    renderProjectDetailPage()

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

  it('renders task progress summary once per layout (PC + SP)', () => {
    mockUseProject.mockReturnValue({
      data: mockProject,
      isLoading: false,
      error: null,
    })
    renderProjectDetailPage()
    expect(screen.getAllByText(/2\/5 completed/)).toHaveLength(2)
    expect(screen.getAllByText(/\(40%\)/)).toHaveLength(2)
  })

  it('renders status breakdown counts once per layout (PC + SP)', () => {
    mockUseProject.mockReturnValue({
      data: mockProject,
      isLoading: false,
      error: null,
    })
    renderProjectDetailPage()
    expect(screen.getAllByText('Todo: 2')).toHaveLength(2)
    expect(screen.getAllByText('In Progress: 1')).toHaveLength(2)
    expect(screen.getAllByText('Completed: 2')).toHaveLength(2)
  })

  it('renders a View Board link to the project board route', () => {
    mockUseProject.mockReturnValue({
      data: mockProject,
      isLoading: false,
      error: null,
    })
    renderProjectDetailPage()
    const links = screen.getAllByText('View Board →')
    expect(links).toHaveLength(2)
    for (const link of links) {
      expect(link.closest('a')).toHaveAttribute(
        'href',
        '/projects/$projectId/board',
      )
    }
  })

  it('renders sidebar field labels once per layout (PC + SP)', () => {
    mockUseProject.mockReturnValue({
      data: mockProject,
      isLoading: false,
      error: null,
    })
    renderProjectDetailPage()
    const labelCounts = {
      Status: screen.getAllByText('Status').length,
      'Start date': screen.getAllByText('Start date').length,
      'Target date': screen.getAllByText('Target date').length,
      Color: screen.getAllByText('Color').length,
    }
    expect(labelCounts).toEqual({
      Status: 2,
      'Start date': 2,
      'Target date': 2,
      Color: 2,
    })
  })

  it('renders remaining days based on the target date once per layout (PC + SP)', () => {
    mockUseProject.mockReturnValue({
      data: mockProject,
      isLoading: false,
      error: null,
    })
    renderProjectDetailPage()
    expect(screen.getAllByText('23 days remaining')).toHaveLength(2)
    expect(screen.getAllByText(/Target: Dec 8, 2024/)).toHaveLength(2)
  })

  it('does not render remaining days when target date is not set', () => {
    mockUseProject.mockReturnValue({
      data: { ...mockProject, targetDate: null },
      isLoading: false,
      error: null,
    })
    renderProjectDetailPage()
    expect(screen.queryByText(/days remaining/)).not.toBeInTheDocument()
  })

  it('allows inline title editing', async () => {
    mockUseProject.mockReturnValue({
      data: mockProject,
      isLoading: false,
      error: null,
    })
    renderProjectDetailPage()
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
    mockUseProject.mockReturnValue({
      data: mockProject,
      isLoading: false,
      error: null,
    })
    renderProjectDetailPage()
    vi.useRealTimers()
    const user = userEvent.setup()

    // Cancel a first edit with Escape without ever blurring the input,
    // simulating a browser that doesn't synchronously fire blur on unmount.
    const titleButtons = screen.getAllByRole('button', { name: 'ISUCON14' })
    await user.click(atIndex(titleButtons, 0))
    await user.keyboard('{Escape}')

    // Re-enter edit mode and save for real.
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
    mockUseProject.mockReturnValue({
      data: mockProject,
      isLoading: false,
      error: null,
    })
    renderProjectDetailPage()
    vi.useRealTimers()
    const user = userEvent.setup()

    const statusSelects = screen.getAllByDisplayValue('Active')
    await user.selectOptions(atIndex(statusSelects, 0), 'paused')

    expect(mockUpdateMutate).toHaveBeenCalledWith({
      id: mockProject.id,
      input: { status: 'paused' },
    })
  })

  it('updates the target date via the sidebar date input', () => {
    mockUseProject.mockReturnValue({
      data: mockProject,
      isLoading: false,
      error: null,
    })
    renderProjectDetailPage()

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
    mockUseProject.mockReturnValue({
      data: mockProject,
      isLoading: false,
      error: null,
    })
    renderProjectDetailPage()
    vi.useRealTimers()
    const user = userEvent.setup()

    const greenSwatches = screen.getAllByTitle('Green')
    await user.click(atIndex(greenSwatches, 0))

    expect(mockUpdateMutate).toHaveBeenCalledWith({
      id: mockProject.id,
      input: { color: '#4CAF50' },
    })
  })

  it('remounts the description editor when switching to a different project', () => {
    mockUseProject.mockReturnValue({
      data: mockProject,
      isLoading: false,
      error: null,
    })
    const { rerender } = renderProjectDetailPage()

    const editorBefore = atIndex(
      screen.getAllByTestId('mock-markdown-editor'),
      0,
    )

    const otherProject = {
      ...mockProject,
      id: 'p2',
      description: 'A different description',
    }
    mockUseProject.mockReturnValue({
      data: otherProject,
      isLoading: false,
      error: null,
    })
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    rerender(
      <QueryClientProvider client={queryClient}>
        <ProjectDetailPage />
      </QueryClientProvider>,
    )

    const editorAfter = atIndex(
      screen.getAllByTestId('mock-markdown-editor'),
      0,
    )
    expect(editorAfter).not.toBe(editorBefore)
  })
})
