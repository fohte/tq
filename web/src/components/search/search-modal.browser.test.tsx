import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { MouseEventHandler, ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SearchModal } from '#components/search/search-modal'
import { resetSessionOpenSettings } from '#hooks/session-open-settings-test-fixtures'
import type { PageSearchResult } from '#hooks/use-search'

interface MockTask {
  id: string
  number: number
  title: string
  description: null
  status: 'todo' | 'completed'
  context: 'work' | 'personal'
  labels: string[]
  startDate: null
  dueDate: null
  estimatedMinutes: number
  parentId: null
  parentNumber: null
  projectId: null
  recurrenceRuleId: null
  recurrenceRule: null
  githubLinks: []
  blockedByNumbers: number[]
  createdAt: string
  updatedAt: string
  childCompletionCount: { completed: number; total: number }
}

function makeTask(overrides: Partial<MockTask> = {}): MockTask {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    number: 1,
    title: 'Implement task list UI',
    description: null,
    status: 'todo',
    context: 'personal',
    labels: [],
    startDate: null,
    dueDate: null,
    estimatedMinutes: 120,
    parentId: null,
    parentNumber: null,
    projectId: null,
    recurrenceRuleId: null,
    recurrenceRule: null,
    githubLinks: [],
    blockedByNumbers: [],
    createdAt: '2026-03-20T00:00:00.000Z',
    updatedAt: '2026-03-20T00:00:00.000Z',
    childCompletionCount: { completed: 0, total: 0 },
    ...overrides,
  }
}

function makePageSearchResult(
  overrides: Partial<PageSearchResult> = {},
): PageSearchResult {
  return {
    source: 'page',
    taskNumber: 42,
    taskTitle: 'Roadmap task',
    pageId: 'page-001',
    pageTitle: 'Architecture notes',
    snippet: 'The architecture notes mention the search flow.',
    matchCount: 1,
    updatedAt: '2026-03-20T00:00:00.000Z',
    ...overrides,
  }
}

const mockTasks = [
  makeTask(),
  makeTask({
    id: '00000000-0000-0000-0000-000000000002',
    number: 2,
    title: 'Review pull request',
    status: 'completed',
    context: 'work',
    estimatedMinutes: 30,
  }),
]

const personalTask = makeTask({
  id: '00000000-0000-0000-0000-000000000003',
  number: 3,
  title: 'Plan weekend trip',
  context: 'personal',
  estimatedMinutes: 60,
})

const mockSuggestions = [
  { value: 'is:todo', display: 'Todo', category: 'is' },
  { value: 'is:completed', display: 'Completed', category: 'is' },
]

let mockSearchData: typeof mockTasks = []
let mockPageSearchData: PageSearchResult[] = []
let mockSuggestionData: typeof mockSuggestions = []

vi.mock('#hooks/use-search', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#hooks/use-search')>()
  return {
    ...actual,
    useSearchTasks: () => ({
      data: mockSearchData.length > 0 ? mockSearchData : undefined,
      isFetching: false,
    }),
    useSearchPages: () => ({
      data: mockPageSearchData.length > 0 ? mockPageSearchData : undefined,
      isFetching: false,
    }),
    useSearchSuggestions: () => ({
      data: mockSuggestionData.length > 0 ? mockSuggestionData : undefined,
    }),
  }
})

const mockNavigate = vi.fn()
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({
      children,
      onClick,
      to,
      role,
      'aria-selected': ariaSelected,
      'data-selected': dataSelected,
      onMouseMove,
      className,
    }: {
      children: ReactNode
      onClick?: MouseEventHandler<HTMLAnchorElement>
      to?: unknown
      role?: string
      'aria-selected'?: boolean
      'data-selected'?: boolean
      onMouseMove?: MouseEventHandler<HTMLAnchorElement>
      className?: string
    }) => (
      <a
        href={typeof to === 'string' ? to : '#'}
        role={role}
        aria-selected={ariaSelected}
        data-selected={dataSelected}
        onMouseMove={onMouseMove}
        className={className}
        onClick={(event) => {
          event.preventDefault()
          onClick?.(event)
        }}
      >
        {children}
      </a>
    ),
  }
})

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
    mockPageSearchData = []
    mockSuggestionData = []
    mockNavigate.mockClear()
  })

  it('renders the search input when open', () => {
    renderSearchModal()
    expect(screen.getByLabelText('Search tasks')).toBeInTheDocument()
  })

  it('shows the current context as the search scope', () => {
    resetSessionOpenSettings({ localContext: 'work' })

    renderSearchModal()

    expect(screen.getByTestId('search-context-scope').textContent).toBe(
      'context:work',
    )
  })

  it('clears the current context when Backspace is pressed on an empty query', async () => {
    resetSessionOpenSettings({ localContext: 'work' })

    const user = userEvent.setup()
    renderSearchModal()

    await user.keyboard('{Backspace}')

    expect(screen.queryByTestId('search-context-scope')).toBeNull()
  })

  it('shows an explicit context token as the active search scope', async () => {
    resetSessionOpenSettings({ localContext: 'personal' })

    const user = userEvent.setup()
    renderSearchModal()

    await user.type(screen.getByLabelText('Search tasks'), 'context:work')

    expect(screen.getByTestId('search-context-scope').textContent).toBe(
      'context:work',
    )
  })

  it('shows initial empty state', () => {
    renderSearchModal()
    expect(screen.getByText('Type to search tasks')).toBeInTheDocument()
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

  it('shows page results with their owning task', async () => {
    mockPageSearchData = [
      makePageSearchResult(),
      makePageSearchResult({
        source: 'comment',
        pageId: null,
        pageTitle: null,
        snippet: 'This comment should stay out of Pages.',
      }),
    ]

    const user = userEvent.setup()
    renderSearchModal()

    await user.type(screen.getByLabelText('Search tasks'), 'architecture')

    const getOutput = () => ({
      group: screen.getByText('Pages').textContent,
      pageTitle: screen.getByText('Architecture notes').textContent,
      task: screen.getByText('#42 Roadmap task').textContent,
      snippet: screen.getByText(
        'The architecture notes mention the search flow.',
      ).textContent,
      commentSnippet:
        screen.queryByText('This comment should stay out of Pages.')
          ?.textContent ?? null,
    })
    expect(getOutput()).toEqual({
      group: 'Pages',
      pageTitle: 'Architecture notes',
      task: '#42 Roadmap task',
      snippet: 'The architecture notes mention the search flow.',
      commentSnippet: null,
    })
  })

  it('navigates to a page detail on Enter', async () => {
    mockPageSearchData = [makePageSearchResult()]
    const onOpenChange = vi.fn()

    const user = userEvent.setup()
    renderSearchModal({ onOpenChange })

    await user.type(screen.getByLabelText('Search tasks'), 'architecture')
    await user.keyboard('{Enter}')

    const getOutput = () => ({
      onOpenChange: onOpenChange.mock.calls,
      navigate: mockNavigate.mock.calls,
    })
    expect(getOutput()).toEqual({
      onOpenChange: [[false]],
      navigate: [
        [
          {
            to: '/tasks/$taskId/pages/$pageId',
            params: { taskId: '42', pageId: 'page-001' },
          },
        ],
      ],
    })
  })

  it('closes modal when clicking a page row', async () => {
    mockPageSearchData = [makePageSearchResult()]
    const onOpenChange = vi.fn()

    const user = userEvent.setup()
    renderSearchModal({ onOpenChange })

    await user.type(screen.getByLabelText('Search tasks'), 'architecture')
    await user.click(screen.getByText('Architecture notes'))

    expect(onOpenChange.mock.calls).toEqual([[false]])
  })

  it('keeps modal open when opening a page row in a new tab', async () => {
    mockPageSearchData = [makePageSearchResult()]
    const onOpenChange = vi.fn()

    const user = userEvent.setup()
    renderSearchModal({ onOpenChange })

    await user.type(screen.getByLabelText('Search tasks'), 'architecture')
    fireEvent.click(screen.getByText('Architecture notes'), { metaKey: true })

    expect(onOpenChange.mock.calls).toEqual([])
  })

  it('displays context badge for personal tasks', async () => {
    mockSearchData = [personalTask]

    const user = userEvent.setup()
    renderSearchModal()

    const input = screen.getByLabelText('Search tasks')
    await user.type(input, 'trip')

    expect(screen.getByText('personal')).toBeInTheDocument()
  })

  it('shows suggestions when data is available', async () => {
    mockSuggestionData = mockSuggestions

    const user = userEvent.setup()
    renderSearchModal()

    const input = screen.getByLabelText('Search tasks')
    await user.type(input, 'is:')

    expect(screen.getByText('is:todo')).toBeInTheDocument()
    expect(screen.getByText('is:completed')).toBeInTheDocument()
  })

  it('navigates through suggestions and selects the following task', async () => {
    mockSuggestionData = mockSuggestions
    mockSearchData = mockTasks

    const user = userEvent.setup()
    renderSearchModal()

    await user.type(screen.getByLabelText('Search tasks'), 'is:')
    const options = screen.getAllByRole('option')

    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}')

    const getOutput = () => [
      options.map((option) => option.getAttribute('aria-selected')),
      mockNavigate.mock.calls,
    ]
    expect(getOutput()).toEqual([
      ['false', 'false', 'true', 'false'],
      [
        [
          {
            to: '/tasks/$taskId',
            params: { taskId: '00000000-0000-0000-0000-000000000001' },
          },
        ],
      ],
    ])
  })

  it('navigates results with arrow keys', async () => {
    mockSearchData = mockTasks

    const user = userEvent.setup()
    renderSearchModal()

    const input = screen.getByLabelText('Search tasks')
    await user.type(input, 'task')

    const options = screen.getAllByRole('option')
    expect(options[0]).toHaveAttribute('aria-selected', 'true')
    expect(options[0]).toHaveClass('bg-accent')

    await user.keyboard('{ArrowDown}')
    expect(options[1]).toHaveAttribute('aria-selected', 'true')
    expect(options[1]).toHaveClass('bg-accent')
    expect(options[0]).toHaveAttribute('aria-selected', 'false')
    expect(options[0]).not.toHaveClass('bg-accent')

    await user.keyboard('{ArrowUp}')
    expect(options[0]).toHaveAttribute('aria-selected', 'true')
    expect(options[0]).toHaveClass('bg-accent')
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

    expect(screen.getByText('no results for "nonexistent"')).toBeInTheDocument()
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

  it('closes modal when clicking a task row', async () => {
    mockSearchData = mockTasks
    const onOpenChange = vi.fn()

    const user = userEvent.setup()
    renderSearchModal({ onOpenChange })

    const input = screen.getByLabelText('Search tasks')
    await user.type(input, 'task')

    await user.click(screen.getByText('Implement task list UI'))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('does not close modal when opening a task row in a new tab', async () => {
    mockSearchData = mockTasks
    const onOpenChange = vi.fn()

    const user = userEvent.setup()
    renderSearchModal({ onOpenChange })

    const input = screen.getByLabelText('Search tasks')
    await user.type(input, 'task')

    fireEvent.click(screen.getByText('Implement task list UI'), {
      metaKey: true,
    })
    expect(onOpenChange).not.toHaveBeenCalled()
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
