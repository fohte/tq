import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { MouseEventHandler, ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { makeSavedView } from '#components/layout/sidebar-test-fixtures'
import { makeProject } from '#components/project/project-test-fixtures'
import { SearchModal } from '#components/search/search-modal'
import {
  makePageSearchResult,
  makeSuggestion,
} from '#components/search/search-test-fixtures'
import { makeTaskDetail } from '#components/task/task-row-test-fixtures'
import { resetSessionOpenSettings } from '#hooks/session-open-settings-test-fixtures'
import type { CurrentRoute } from '#hooks/use-current-route'
import type { Project } from '#hooks/use-projects'
import type { SavedView } from '#hooks/use-saved-views'
import type { PageSearchResult } from '#hooks/use-search'
import type { TaskDetail } from '#hooks/use-tasks'

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

const firstMockTask = makeTask()

const mockTasks = [
  firstMockTask,
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

const parentTaskDetail = makeTaskDetail({
  id: '00000000-0000-0000-0000-000000000030',
  number: 30,
  title: 'Prepare product launch',
})
const currentTaskDetail = makeTaskDetail({
  id: '00000000-0000-0000-0000-000000000031',
  number: 31,
  title: 'Review launch checklist',
  parentId: parentTaskDetail.id,
  parentNumber: parentTaskDetail.number,
  projectId: '00000000-0000-0000-0000-000000000032',
})
const currentTaskProject = makeProject({
  id: currentTaskDetail.projectId ?? '',
  title: 'Product launch',
})

const mockSuggestions = [
  makeSuggestion(),
  makeSuggestion({ value: 'is:completed', display: 'Completed' }),
]

let mockSearchData: typeof mockTasks = []
let mockNumberTaskData: MockTask | undefined
let mockPageSearchData: PageSearchResult[] = []
let mockSuggestionData: typeof mockSuggestions = []
let mockProjectData: Project[] = []
let mockSavedViewData: SavedView[] = []
let mockScopeLabels = new Map<string, string>()
let mockProjectCalls: Array<{ filter: unknown; options: unknown }> = []
let mockSavedViewCalls: Array<{ filter: unknown; options: unknown }> = []
let mockCurrentRoute: CurrentRoute = { kind: 'other' }
let mockTaskDetails: Record<string, TaskDetail> = {}

vi.mock('#hooks/use-search', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#hooks/use-search')>()
  return {
    ...actual,
    useSearchTasks: () => ({
      data: mockSearchData.length > 0 ? mockSearchData : undefined,
      isFetching: false,
    }),
    useSearchTaskByNumber: () => ({
      data: mockNumberTaskData,
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

vi.mock('#hooks/use-current-route', () => ({
  useCurrentRoute: () => mockCurrentRoute,
}))

vi.mock('#hooks/use-tasks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#hooks/use-tasks')>()
  return {
    ...actual,
    useTask: (id: string) => ({ data: mockTaskDetails[id] }),
  }
})

vi.mock('#hooks/use-projects', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#hooks/use-projects')>()
  return {
    ...actual,
    useProjects: (filter: unknown, options: unknown) => {
      mockProjectCalls.push({ filter, options })
      return { data: mockProjectData }
    },
  }
})

vi.mock('#hooks/use-saved-views', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#hooks/use-saved-views')>()
  return {
    ...actual,
    useSavedViews: (filter: unknown, options: unknown) => {
      mockSavedViewCalls.push({ filter, options })
      return { data: mockSavedViewData }
    },
  }
})

vi.mock('#hooks/use-search-scope-labels', () => ({
  useSearchScopeLabels: (tokens: string[]) =>
    tokens.map((token) => ({
      token,
      label: mockScopeLabels.get(token) ?? token,
    })),
}))

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
    defaultQuery?: string
  } = {},
) {
  const onOpenChange = props.onOpenChange ?? vi.fn()

  return {
    onOpenChange,
    ...render(
      <Wrapper>
        <SearchModal
          open={props.open ?? true}
          onOpenChange={onOpenChange}
          {...(props.defaultQuery === undefined
            ? {}
            : { defaultQuery: props.defaultQuery })}
        />
      </Wrapper>,
    ),
  }
}

function setCurrentTaskRoute(
  task: TaskDetail = currentTaskDetail,
  parent: TaskDetail = parentTaskDetail,
) {
  mockCurrentRoute = { kind: 'task-detail', taskId: task.id }
  mockTaskDetails = {
    [task.id]: task,
    ...(task.parentId === parent.id ? { [parent.id]: parent } : {}),
  }
}

describe('SearchModal', () => {
  beforeEach(() => {
    mockSearchData = []
    mockNumberTaskData = undefined
    mockPageSearchData = []
    mockSuggestionData = []
    mockProjectData = []
    mockSavedViewData = []
    mockScopeLabels = new Map()
    mockProjectCalls = []
    mockSavedViewCalls = []
    mockCurrentRoute = { kind: 'other' }
    mockTaskDetails = {}
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

  it('clears the current context when its remove button is clicked', async () => {
    resetSessionOpenSettings({ localContext: 'work' })

    const user = userEvent.setup()
    renderSearchModal()

    await user.click(
      screen.getByRole('button', { name: 'Remove context:work scope' }),
    )

    expect(screen.queryByTestId('search-context-scope')).toBeNull()
  })

  it('removes the last scope before clearing the current context', async () => {
    resetSessionOpenSettings({ localContext: 'work' })
    mockSearchData = [firstMockTask]

    const user = userEvent.setup()
    renderSearchModal()

    const input = screen.getByLabelText('Search tasks')
    await user.type(input, 'task')
    await user.keyboard('{Tab}{Backspace}')

    const getOutput = () => ({
      scopes: screen
        .queryAllByTestId('search-scope-token')
        .map((element) => element.textContent),
      context:
        screen.queryByTestId('search-context-scope')?.textContent ?? null,
    })
    expect(getOutput()).toEqual({ scopes: [], context: 'context:work' })
  })

  it('removes only the latest scope token with Backspace', async () => {
    const projectId = '00000000-0000-0000-0000-000000000101'
    const parentId = '00000000-0000-0000-0000-000000000102'
    const user = userEvent.setup()
    renderSearchModal({
      defaultQuery: `project:${projectId} parent:${parentId} `,
    })

    await user.keyboard('{Backspace}')

    const getOutput = () => ({
      scopes: screen
        .queryAllByTestId('search-scope-token')
        .map((element) => element.textContent),
      inputValue: screen.getByLabelText<HTMLInputElement>('Search tasks').value,
    })
    expect(getOutput()).toEqual({
      scopes: [`project:${projectId}`],
      inputValue: '',
    })
  })

  it('shows the provided scope names and removes only the clicked scope', async () => {
    const projectId = '00000000-0000-0000-0000-000000000104'
    const parentId = '00000000-0000-0000-0000-000000000105'
    mockScopeLabels = new Map([
      [`project:${projectId}`, 'project:Roadmap'],
      [`parent:${parentId}`, 'parent:#7 Implement milestones'],
    ])

    const user = userEvent.setup()
    renderSearchModal({
      defaultQuery: `project:${projectId} parent:${parentId} planning `,
    })

    const getOutput = () => ({
      scopes: screen
        .queryAllByTestId('search-scope-token')
        .map((element) => element.textContent),
      inputValue: screen.getByLabelText<HTMLInputElement>('Search tasks').value,
    })
    expect(getOutput()).toEqual({
      scopes: ['project:Roadmap', 'parent:#7 Implement milestones'],
      inputValue: 'planning ',
    })

    await user.click(
      screen.getByRole('button', { name: 'Remove project:Roadmap scope' }),
    )

    expect(getOutput()).toEqual({
      scopes: ['parent:#7 Implement milestones'],
      inputValue: 'planning ',
    })
  })

  it('removes an explicit context filter from the query', async () => {
    const user = userEvent.setup()
    renderSearchModal({ defaultQuery: '"context:work"' })

    await user.click(
      screen.getByRole('button', { name: 'Remove context:work scope' }),
    )

    const getOutput = () => ({
      context:
        screen.queryByTestId('search-context-scope')?.textContent ?? null,
      inputValue: screen.getByLabelText<HTMLInputElement>('Search tasks').value,
    })
    expect(getOutput()).toEqual({ context: null, inputValue: '' })
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

    const input = screen.getByLabelText<HTMLInputElement>('Search tasks')
    await user.type(input, 'task')

    expect(screen.getByText('Implement task list UI')).toBeInTheDocument()
    expect(screen.getByText('Review pull request')).toBeInTheDocument()
  })

  it('shows project results', async () => {
    mockProjectData = [makeProject({ title: 'Project alpha' })]

    const user = userEvent.setup()
    renderSearchModal()

    await user.type(screen.getByLabelText('Search tasks'), 'alpha')

    const getOutput = () => ({
      groupTitle: screen.getByText('Projects').textContent,
      options: screen
        .getAllByRole('option')
        .map((option) => option.textContent),
    })
    expect(getOutput()).toEqual({
      groupTitle: 'Projects',
      options: ['Project alpha'],
    })
  })

  it('shows saved view results', async () => {
    mockSavedViewData = [makeSavedView({ name: 'Active tasks' })]

    const user = userEvent.setup()
    renderSearchModal()

    await user.type(screen.getByLabelText('Search tasks'), 'active')

    const getOutput = () => ({
      groupTitle: screen.getByText('Views').textContent,
      options: screen
        .getAllByRole('option')
        .map((option) => option.textContent),
    })
    expect(getOutput()).toEqual({
      groupTitle: 'Views',
      options: ['Active tasks'],
    })
  })

  it('passes parsed free text and context to project and view searches', async () => {
    resetSessionOpenSettings({ localContext: 'personal' })

    const user = userEvent.setup()
    renderSearchModal()

    await user.type(
      screen.getByLabelText('Search tasks'),
      'context:work active',
    )

    await waitFor(() => {
      const getOutput = () => ({
        project: mockProjectCalls[mockProjectCalls.length - 1],
        view: mockSavedViewCalls[mockSavedViewCalls.length - 1],
      })
      expect(getOutput()).toEqual({
        project: {
          filter: { q: 'active', context: 'work' },
          options: { enabled: true },
        },
        view: {
          filter: { q: 'active', context: 'work' },
          options: { enabled: true },
        },
      })
    })
  })

  it('hides project and view results for syntax-only queries', async () => {
    mockProjectData = [makeProject({ title: 'Project alpha' })]
    mockSavedViewData = [makeSavedView({ name: 'Active tasks' })]

    const user = userEvent.setup()
    renderSearchModal()

    await user.type(screen.getByLabelText('Search tasks'), 'context:work')

    const getOutput = () => ({
      project: screen.queryByText('Project alpha')?.textContent ?? null,
      view: screen.queryByText('Active tasks')?.textContent ?? null,
    })
    expect(getOutput()).toEqual({ project: null, view: null })
  })

  it('opens an exact task number match before scoped search results', async () => {
    mockNumberTaskData = personalTask
    mockSearchData = mockTasks.slice(1, 2)
    const onOpenChange = vi.fn()

    const user = userEvent.setup()
    renderSearchModal({ onOpenChange })

    await user.type(screen.getByLabelText('Search tasks'), '#3')

    const options = screen.getAllByRole('option')
    const directIndex = options.findIndex((option) =>
      option.contains(screen.getByText('Plan weekend trip')),
    )
    const searchIndex = options.findIndex((option) =>
      option.contains(screen.getByText('Review pull request')),
    )
    await user.keyboard('{Enter}')

    const getOutput = () => [
      directIndex,
      searchIndex,
      options.map((option) => option.getAttribute('aria-selected')),
      onOpenChange.mock.calls,
      mockNavigate.mock.calls,
    ]
    expect(getOutput()).toEqual([
      0,
      1,
      ['true', 'false'],
      [[false]],
      [
        [
          {
            to: '/tasks/$taskId',
            params: { taskId: personalTask.id },
          },
        ],
      ],
    ])
  })

  it('does not repeat the exact match in scoped search results', async () => {
    mockNumberTaskData = firstMockTask
    mockSearchData = [firstMockTask]

    const user = userEvent.setup()
    renderSearchModal()

    await user.type(screen.getByLabelText('Search tasks'), '#1')

    expect(
      screen
        .getAllByText('Implement task list UI')
        .map((element) => element.textContent),
    ).toEqual(['Implement task list UI'])
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

  it('shows current task navigation commands before global commands', () => {
    setCurrentTaskRoute()
    mockProjectData = [currentTaskProject]

    renderSearchModal({ defaultQuery: '>' })

    const getOutput = () => ({
      taskHeading: screen.getByText('#31 Review launch checklist').textContent,
      globalHeading: screen.getByText('Commands').textContent,
      options: screen.getAllByRole('option').map((option) =>
        Array.from(option.children)
          .map((child) => child.textContent)
          .join(' ')
          .trim(),
      ),
    })
    expect(getOutput()).toEqual({
      taskHeading: '#31 Review launch checklist',
      globalHeading: 'Commands',
      options: [
        'Go to parent: #30 Prepare product launch',
        'Go to project: Product launch',
        'go to today g d',
        'go to calendar g c',
        'go to inbox g i',
        'go to tasks g t',
        'go to projects g p',
        'go to settings g s',
      ],
    })
  })

  it('navigates to the parent task with Enter', async () => {
    setCurrentTaskRoute()
    mockProjectData = [currentTaskProject]
    const onOpenChange = vi.fn()

    const user = userEvent.setup()
    renderSearchModal({ defaultQuery: '>', onOpenChange })
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
            to: '/tasks/$taskId',
            params: { taskId: parentTaskDetail.id },
          },
        ],
      ],
    })
  })

  it('navigates to the project with Enter when its command is selected', async () => {
    setCurrentTaskRoute()
    mockProjectData = [currentTaskProject]
    const onOpenChange = vi.fn()

    const user = userEvent.setup()
    renderSearchModal({ defaultQuery: '>', onOpenChange })
    await user.keyboard('{ArrowDown}{Enter}')

    const getOutput = () => ({
      onOpenChange: onOpenChange.mock.calls,
      navigate: mockNavigate.mock.calls,
    })
    expect(getOutput()).toEqual({
      onOpenChange: [[false]],
      navigate: [
        [
          {
            to: '/projects/$projectId',
            params: { projectId: currentTaskProject.id },
          },
        ],
      ],
    })
  })

  it('applies the current task scope with Tab while preserving the project scope', async () => {
    setCurrentTaskRoute()
    mockProjectData = [currentTaskProject]

    const user = userEvent.setup()
    renderSearchModal({
      defaultQuery: `project:${currentTaskProject.id} `,
    })
    await user.keyboard('{Tab}')

    const getOutput = () => ({
      scopes: screen
        .queryAllByTestId('search-scope-token')
        .map((element) => element.textContent),
      options: screen
        .getAllByRole('option')
        .map((option) => option.innerText.trim()),
      inputValue: screen.getByLabelText<HTMLInputElement>('Search tasks').value,
    })
    expect(getOutput()).toEqual({
      scopes: [
        `project:${currentTaskProject.id}`,
        `parent:${currentTaskDetail.id}`,
      ],
      options: [
        'children of #31 Review launch checklist',
        'siblings (children of #30 Prepare product launch)',
      ],
      inputValue: '',
    })
  })

  it('applies the parent scope with Enter to find sibling tasks', async () => {
    setCurrentTaskRoute()
    mockProjectData = [currentTaskProject]

    const user = userEvent.setup()
    renderSearchModal({
      defaultQuery: `project:${currentTaskProject.id} `,
    })
    await user.keyboard('{ArrowDown}{Enter}')

    const getOutput = () => ({
      scopes: screen
        .queryAllByTestId('search-scope-token')
        .map((element) => element.textContent),
      options: screen
        .getAllByRole('option')
        .map((option) => option.innerText.trim()),
      inputValue: screen.getByLabelText<HTMLInputElement>('Search tasks').value,
    })
    expect(getOutput()).toEqual({
      scopes: [
        `project:${currentTaskProject.id}`,
        `parent:${parentTaskDetail.id}`,
      ],
      options: [
        'children of #31 Review launch checklist',
        'siblings (children of #30 Prepare product launch)',
      ],
      inputValue: '',
    })
  })

  it('omits parent and project commands when the current task has neither', () => {
    const standaloneTask = makeTaskDetail({
      id: '00000000-0000-0000-0000-000000000033',
      number: 33,
      title: 'Standalone task',
      parentId: null,
      parentNumber: null,
      projectId: null,
    })
    setCurrentTaskRoute(standaloneTask)

    renderSearchModal({ defaultQuery: '>' })

    const getOutput = () => ({
      taskHeading:
        screen.queryByText('#33 Standalone task')?.textContent ?? null,
      parentCommand:
        screen.queryByRole('option', {
          name: 'Go to parent: #30 Prepare product launch',
        })?.textContent ?? null,
      projectCommand:
        screen.queryByRole('option', {
          name: 'Go to project: Product launch',
        })?.textContent ?? null,
    })
    expect(getOutput()).toEqual({
      taskHeading: null,
      parentCommand: null,
      projectCommand: null,
    })
  })

  it('narrows a selected task to its children with Tab and returns to default mode', async () => {
    mockSearchData = [firstMockTask]

    const user = userEvent.setup()
    renderSearchModal()

    const input = screen.getByLabelText<HTMLInputElement>('Search tasks')
    await user.type(input, '#task')
    await user.keyboard('{Tab}')

    const getOutput = () => ({
      scopes: screen
        .queryAllByTestId('search-scope-token')
        .map((element) => element.textContent),
      inputValue: input.value,
      mode: screen.getByTestId('search-mode-indicator').textContent,
    })
    expect(getOutput()).toEqual({
      scopes: [`parent:${firstMockTask.id}`],
      inputValue: '',
      mode: '›',
    })
  })

  it('narrows a selected project to its tasks with Tab', async () => {
    const project = makeProject({
      id: '00000000-0000-0000-0000-000000000103',
      title: 'Project alpha',
    })
    mockProjectData = [project]

    const user = userEvent.setup()
    renderSearchModal()

    const input = screen.getByLabelText<HTMLInputElement>('Search tasks')
    await user.type(input, 'alpha')
    await user.keyboard('{Tab}')

    const getOutput = () => ({
      scopes: screen
        .queryAllByTestId('search-scope-token')
        .map((element) => element.textContent),
      inputValue: input.value,
    })
    expect(getOutput()).toEqual({
      scopes: [`project:${project.id}`],
      inputValue: '',
    })
  })

  it('keeps an unfinished project token editable', async () => {
    const user = userEvent.setup()
    renderSearchModal()

    const input = screen.getByLabelText<HTMLInputElement>('Search tasks')
    await user.type(input, 'project:alpha')

    const getOutput = () => ({
      scopes: screen
        .queryAllByTestId('search-scope-token')
        .map((element) => element.textContent),
      inputValue: input.value,
    })
    expect(getOutput()).toEqual({ scopes: [], inputValue: 'project:alpha' })
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

  it('closes modal and navigates to project on Enter', async () => {
    const project = makeProject({ id: 'project-alpha', title: 'Project alpha' })
    mockProjectData = [project]
    const onOpenChange = vi.fn()

    const user = userEvent.setup()
    renderSearchModal({ onOpenChange })

    await user.type(screen.getByLabelText('Search tasks'), 'alpha')
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
            to: '/projects/$projectId',
            params: { projectId: project.id },
          },
        ],
      ],
    })
  })

  it('closes modal and navigates to saved view on Enter', async () => {
    const view = makeSavedView({
      id: 'view-alpha',
      name: 'Active tasks',
      query: 'is:todo',
    })
    mockSavedViewData = [view]
    const onOpenChange = vi.fn()

    const user = userEvent.setup()
    renderSearchModal({ onOpenChange })

    await user.type(screen.getByLabelText('Search tasks'), 'active')
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
            to: '/tasks',
            search: { q: view.query },
          },
        ],
      ],
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
