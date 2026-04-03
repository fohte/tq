import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SearchView } from '@web/components/search/search-view'
import { atIndex } from '@web/lib/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockResults = [
  {
    id: '1',
    title: 'Deploy to production',
    description: null,
    status: 'todo' as 'todo' | 'in_progress' | 'completed',
    context: 'work' as 'work' | 'personal' | 'dev',
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
    id: '2',
    title: 'Fix armyknife build',
    description: null,
    status: 'in_progress' as 'todo' | 'in_progress' | 'completed',
    context: 'dev' as 'work' | 'personal' | 'dev',
    startDate: null,
    dueDate: null,
    estimatedMinutes: 90,
    parentId: null,
    projectId: null,
    sortOrder: 0,
    recurrenceRuleId: null,
    recurrenceRule: null,
    createdAt: '2026-03-20T00:00:00.000Z',
    updatedAt: '2026-03-20T00:00:00.000Z',
    activeTimeBlockStartTime: null,
  },
]

let mockSearchReturn = {
  query: '',
  setQuery: vi.fn(),
  freeText: '',
  filters: {} as Record<string, string | undefined>,
  results: [] as typeof mockResults,
  isLoading: false,
  isFetching: false,
  hasQuery: false,
  updateFilter: vi.fn(),
  clearFilter: vi.fn(),
}

vi.mock('@web/hooks/use-search', () => ({
  useSearch: () => mockSearchReturn,
}))

function renderSearchView(onBack?: () => void) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <SearchView onBack={onBack} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSearchReturn = {
    query: '',
    setQuery: vi.fn(),
    freeText: '',
    filters: {},
    results: [],
    isLoading: false,
    isFetching: false,
    hasQuery: false,
    updateFilter: vi.fn(),
    clearFilter: vi.fn(),
  }
})

describe('SearchView', () => {
  it('renders search input', () => {
    renderSearchView()
    expect(screen.getByTestId('search-input')).toBeInTheDocument()
  })

  it('renders filter chips', () => {
    renderSearchView()
    expect(screen.getByTestId('filter-chip-status')).toBeInTheDocument()
    expect(screen.getByTestId('filter-chip-context')).toBeInTheDocument()
    expect(screen.getByTestId('filter-chip-sort')).toBeInTheDocument()
  })

  it('shows placeholder when no query', () => {
    renderSearchView()
    expect(screen.getByText('Type to search tasks')).toBeInTheDocument()
  })

  it('shows search results', () => {
    mockSearchReturn.hasQuery = true
    mockSearchReturn.results = mockResults
    renderSearchView()

    expect(screen.getByText('Deploy to production')).toBeInTheDocument()
    expect(screen.getByText('Fix armyknife build')).toBeInTheDocument()
  })

  it('shows no results message', () => {
    mockSearchReturn.hasQuery = true
    mockSearchReturn.results = []
    renderSearchView()

    expect(screen.getByText('No results found')).toBeInTheDocument()
  })

  it('calls setQuery on input change', async () => {
    const user = userEvent.setup()
    renderSearchView()

    const input = screen.getByTestId('search-input')
    await user.type(input, 'test')

    expect(mockSearchReturn.setQuery).toHaveBeenCalled()
  })

  it('renders back button when onBack is provided', () => {
    const onBack = vi.fn()
    renderSearchView(onBack)
    expect(screen.getByLabelText('Back')).toBeInTheDocument()
  })

  it('does not render back button when onBack is not provided', () => {
    renderSearchView()
    expect(screen.queryByLabelText('Back')).not.toBeInTheDocument()
  })

  it('calls onBack when back button clicked', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    renderSearchView(onBack)

    await user.click(screen.getByLabelText('Back'))
    expect(onBack).toHaveBeenCalledOnce()
  })

  describe('filter chips - bidirectional sync', () => {
    it('opens filter dropdown on click', async () => {
      const user = userEvent.setup()
      renderSearchView()

      await user.click(screen.getByTestId('filter-chip-status'))
      expect(screen.getByTestId('filter-dropdown-status')).toBeInTheDocument()
    })

    it('calls updateFilter when selecting a status option', async () => {
      const user = userEvent.setup()
      renderSearchView()

      await user.click(screen.getByTestId('filter-chip-status'))
      const dropdown = screen.getByTestId('filter-dropdown-status')
      await user.click(within(dropdown).getByText('Todo'))

      expect(mockSearchReturn.updateFilter).toHaveBeenCalledWith(
        'status',
        'todo',
      )
    })

    it('calls updateFilter when selecting a context option', async () => {
      const user = userEvent.setup()
      renderSearchView()

      await user.click(screen.getByTestId('filter-chip-context'))
      const dropdown = screen.getByTestId('filter-dropdown-context')
      await user.click(within(dropdown).getByText('Work'))

      expect(mockSearchReturn.updateFilter).toHaveBeenCalledWith(
        'context',
        'work',
      )
    })

    it('shows active filter value in chip label', () => {
      mockSearchReturn.filters = { status: 'todo' }
      renderSearchView()

      expect(screen.getByTestId('filter-chip-status')).toHaveTextContent('Todo')
    })

    it('deselects filter when clicking active option', async () => {
      const user = userEvent.setup()
      mockSearchReturn.filters = { status: 'todo' }
      renderSearchView()

      await user.click(screen.getByTestId('filter-chip-status'))
      const dropdown = screen.getByTestId('filter-dropdown-status')
      await user.click(within(dropdown).getByText('Todo'))

      expect(mockSearchReturn.updateFilter).toHaveBeenCalledWith(
        'status',
        undefined,
      )
    })
  })

  describe('search results display', () => {
    it('displays context badge for work tasks', () => {
      mockSearchReturn.hasQuery = true
      mockSearchReturn.results = [atIndex(mockResults, 0)]
      renderSearchView()

      expect(screen.getByText('work')).toBeInTheDocument()
    })

    it('displays estimated time', () => {
      mockSearchReturn.hasQuery = true
      mockSearchReturn.results = [atIndex(mockResults, 0)]
      renderSearchView()

      expect(screen.getByText('2h')).toBeInTheDocument()
    })

    it('renders completed tasks with reduced opacity', () => {
      mockSearchReturn.hasQuery = true
      mockSearchReturn.results = [
        {
          ...atIndex(mockResults, 0),
          status: 'completed' as const,
        },
      ]
      renderSearchView()

      const row = screen.getByTestId('search-result-row')
      expect(row.className).toContain('opacity-50')
    })
  })
})
