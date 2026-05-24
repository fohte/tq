import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SearchModal } from '@web/components/search/search-modal'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockTasks = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    title: 'Implement task list UI',
    description: null,
    status: 'todo' as const,
    context: 'dev' as const,
    startDate: null,
    dueDate: null,
    estimatedMinutes: 120,
    parentId: null,
    projectId: null,
    sortOrder: 0,
    recurrenceRuleId: null,
    recurrenceRule: null,
    createdAt: '2026-03-20T00:00:00.000Z',
    updatedAt: '2026-03-20T00:00:00.000Z',
    activeTimeBlockStartTime: null,
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    title: 'Review pull request',
    description: null,
    status: 'in_progress' as const,
    context: 'work' as const,
    startDate: null,
    dueDate: null,
    estimatedMinutes: 30,
    parentId: null,
    projectId: null,
    sortOrder: 1,
    recurrenceRuleId: null,
    recurrenceRule: null,
    createdAt: '2026-03-20T00:00:00.000Z',
    updatedAt: '2026-03-20T00:00:00.000Z',
    activeTimeBlockStartTime: null,
  },
]

const mockSuggestions = [
  { value: 'is:todo', display: 'Todo', category: 'is' },
  { value: 'is:in_progress', display: 'In Progress', category: 'is' },
]

let mockSearchData: typeof mockTasks = []
let mockSuggestionData: typeof mockSuggestions = []

vi.mock('@web/hooks/use-search', () => ({
  useSearchTasks: () => ({
    data: mockSearchData.length > 0 ? mockSearchData : undefined,
    isFetching: false,
  }),
  useSearchSuggestions: () => ({
    data: mockSuggestionData.length > 0 ? mockSuggestionData : undefined,
  }),
}))

const mockNavigate = vi.fn()
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}))

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

function renderSearchModal(
  props: {
    open?: boolean
    onOpenChange?: (open: boolean) => void
  } = {},
) {
  const onOpenChange = props.onOpenChange ?? vi.fn()

  return {
    onOpenChange,
    ...render(
      <Wrapper>
        <SearchModal open={props.open ?? true} onOpenChange={onOpenChange} />
      </Wrapper>,
    ),
  }
}

describe('SearchModal', () => {
  beforeEach(() => {
    mockSearchData = []
    mockSuggestionData = []
    mockNavigate.mockClear()
  })

  it('renders the search input when open', () => {
    renderSearchModal()
    expect(screen.getByLabelText('Search tasks')).toBeInTheDocument()
  })

  it('shows initial empty state', () => {
    renderSearchModal()
    expect(screen.getByText('Type to search tasks...')).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    renderSearchModal({ open: false })
    expect(screen.queryByLabelText('Search tasks')).not.toBeInTheDocument()
  })

  it('calls onOpenChange(false) when Escape is pressed', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    renderSearchModal({ onOpenChange })

    await user.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('shows search results when data is available', async () => {
    mockSearchData = mockTasks

    const user = userEvent.setup()
    renderSearchModal()

    const input = screen.getByLabelText('Search tasks')
    await user.type(input, 'task')

    expect(screen.getByText('Implement task list UI')).toBeInTheDocument()
    expect(screen.getByText('Review pull request')).toBeInTheDocument()
  })

  it('shows suggestions when data is available', async () => {
    mockSuggestionData = mockSuggestions

    const user = userEvent.setup()
    renderSearchModal()

    const input = screen.getByLabelText('Search tasks')
    await user.type(input, 'is:')

    expect(screen.getByText('is:todo')).toBeInTheDocument()
    expect(screen.getByText('is:in_progress')).toBeInTheDocument()
  })

  it('navigates results with arrow keys', async () => {
    mockSearchData = mockTasks

    const user = userEvent.setup()
    renderSearchModal()

    const input = screen.getByLabelText('Search tasks')
    await user.type(input, 'task')

    const options = screen.getAllByRole('option')
    expect(options[0]).toHaveAttribute('aria-selected', 'true')

    await user.keyboard('{ArrowDown}')
    expect(options[1]).toHaveAttribute('aria-selected', 'true')
    expect(options[0]).toHaveAttribute('aria-selected', 'false')

    await user.keyboard('{ArrowUp}')
    expect(options[0]).toHaveAttribute('aria-selected', 'true')
  })

  it('applies suggestion with Tab key', async () => {
    mockSuggestionData = mockSuggestions

    const user = userEvent.setup()
    renderSearchModal()

    const input = screen.getByLabelText('Search tasks')
    await user.type(input, 'is:')

    await user.keyboard('{Tab}')
    expect(input).toHaveValue('is:todo ')
  })

  it('shows no results message when search returns empty and query is typed', async () => {
    const user = userEvent.setup()
    renderSearchModal()

    const input = screen.getByLabelText('Search tasks')
    await user.type(input, 'nonexistent')

    expect(screen.getByText('No results found')).toBeInTheDocument()
  })

  it('shows keyboard hints in footer', () => {
    renderSearchModal()
    expect(screen.getByText(/navigate/)).toBeInTheDocument()
    expect(screen.getByText(/autocomplete/)).toBeInTheDocument()
  })

  it('wraps around when navigating past the last item', async () => {
    mockSearchData = mockTasks

    const user = userEvent.setup()
    renderSearchModal()

    const input = screen.getByLabelText('Search tasks')
    await user.type(input, 'task')

    const options = screen.getAllByRole('option')

    await user.keyboard('{ArrowDown}')
    expect(options[1]).toHaveAttribute('aria-selected', 'true')

    await user.keyboard('{ArrowDown}')
    expect(options[0]).toHaveAttribute('aria-selected', 'true')
  })

  it('closes modal and navigates to task on Enter', async () => {
    mockSearchData = mockTasks
    const onOpenChange = vi.fn()

    const user = userEvent.setup()
    renderSearchModal({ onOpenChange })

    const input = screen.getByLabelText('Search tasks')
    await user.type(input, 'task')

    await user.keyboard('{Enter}')
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/tasks/$taskId',
      params: { taskId: '00000000-0000-0000-0000-000000000001' },
    })
  })

  it('closes modal when clicking backdrop', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    renderSearchModal({ onOpenChange })

    const overlay = screen.getByTestId('search-overlay')
    await user.click(overlay)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
