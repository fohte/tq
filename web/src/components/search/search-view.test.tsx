import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SearchView } from '#components/search/search-view'
import { atIndex } from '#lib/test-utils'

interface MockResult {
  id: string
  title: string
  description: null
  status: 'todo' | 'in_progress' | 'completed'
  context: 'work' | 'personal'
  startDate: null
  dueDate: null
  estimatedMinutes: number
  parentId: null
  projectId: null
  sortOrder: number
  recurrenceRuleId: null
  recurrenceRule: null
  createdAt: string
  updatedAt: string
}

function makeResult(overrides: Partial<MockResult> = {}): MockResult {
  return {
    id: '1',
    title: 'Deploy to production',
    description: null,
    status: 'todo',
    context: 'work',
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
    ...overrides,
  }
}

const mockResults = [
  makeResult(),
  makeResult({
    id: '2',
    title: 'Fix armyknife build',
    status: 'in_progress',
    context: 'personal',
    estimatedMinutes: 90,
  }),
  makeResult({
    id: '3',
    title: 'Plan weekend trip',
    context: 'personal',
    estimatedMinutes: 60,
  }),
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

vi.mock('#hooks/use-search', () => ({
  useSearch: () => mockSearchReturn,
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    ...props
  }: { children: import('react').ReactNode } & Record<string, unknown>) => {
    const { to, params, ...rest } = props
    void params
    return (
      <a href={typeof to === 'string' ? to : '#'} {...rest}>
        {children}
      </a>
    )
  },
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
    mockSearchReturn.query = 'nonexistent'
    mockSearchReturn.results = []
    renderSearchView()

    expect(screen.getByText('no results for "nonexistent"')).toBeInTheDocument()
  })

  it('calls setQuery on input change', async () => {
    const user = userEvent.setup()
    renderSearchView()

    const input = screen.getByTestId('search-input')
    await user.type(input, 'test')

    expect(mockSearchReturn.setQuery).toHaveBeenCalled()
  })

  it('renders esc-to-close hint when onBack is provided', () => {
    const onBack = vi.fn()
    renderSearchView(onBack)
    expect(screen.getByText('esc to close')).toBeInTheDocument()
  })

  it('does not render esc-to-close hint when onBack is not provided', () => {
    renderSearchView()
    expect(screen.queryByText('esc to close')).not.toBeInTheDocument()
  })

  it('calls onBack when esc-to-close hint clicked', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    renderSearchView(onBack)

    await user.click(screen.getByText('esc to close'))
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

    it('displays context badge for personal tasks', () => {
      mockSearchReturn.hasQuery = true
      mockSearchReturn.results = [atIndex(mockResults, 2)]
      renderSearchView()

      expect(screen.getByText('personal')).toBeInTheDocument()
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
      expect(row).toHaveClass('opacity-[0.55]')
    })
  })
})
