import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TaskGridRow } from '#components/task/task-grid-row'
import { TagFilterProvider, useTagFilter } from '#hooks/use-tag-filter'
import type { Task } from '#hooks/use-tasks'
import { atIndex } from '#lib/test-utils'

const mockMutate = vi.fn()
const mockUpdateStatusMutate = vi.fn()
// Fires when a click bubbles up to the row's Link. A tag token's onClick
// calls stopPropagation, so this spy lets tests confirm that click never
// reaches the Link (i.e. no navigation), without relying on jsdom's <a> not
// actually navigating.
const mockLinkOnClick = vi.fn()

vi.mock('#hooks/use-tasks', () => ({
  useCompleteTask: () => ({ mutate: mockMutate }),
  useUpdateTaskStatus: () => ({ mutate: mockUpdateStatusMutate }),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    ...props
  }: { children: React.ReactNode } & Record<string, unknown>) => (
    <a
      href={typeof props['to'] === 'string' ? props['to'] : '#'}
      onClick={mockLinkOnClick}
    >
      {children}
    </a>
  ),
}))

// Base UI's Menu relies on pointer events that jsdom does not implement
// reliably, so the picker is stubbed here to exercise TaskGridRow's status
// change wiring directly. The real menu interaction is covered by
// task-status-picker.stories.tsx (runs in a real browser via Storybook).
vi.mock('#components/task/task-status-picker', () => ({
  TaskStatusPicker: ({
    onStatusChange,
  }: {
    status: string
    onStatusChange: (status: string) => void
  }) => (
    <div>
      <button
        onClick={() => {
          onStatusChange('todo')
        }}
      >
        Set Todo
      </button>
      <button
        onClick={() => {
          onStatusChange('in_progress')
        }}
      >
        Set In Progress
      </button>
      <button
        onClick={() => {
          onStatusChange('completed')
        }}
      >
        Set Completed
      </button>
    </div>
  ),
}))

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    number: 1,
    title: 'Task title',
    description: null,
    status: 'todo',
    context: 'personal',
    labels: [],
    startDate: null,
    dueDate: null,
    estimatedMinutes: null,
    parentId: null,
    parentNumber: null,
    projectId: null,
    sortOrder: 0,
    recurrenceRuleId: null,
    recurrenceRule: null,
    githubLink: null,
    createdAt: '2026-03-20T00:00:00.000Z',
    updatedAt: '2026-03-20T00:00:00.000Z',
    ...overrides,
  }
}

function TagProbe() {
  const { tag } = useTagFilter()
  return <div data-testid="tag-probe">{tag ?? 'none'}</div>
}

function renderRow(task: Task) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <TagFilterProvider>
        <TaskGridRow task={task} />
        <TagProbe />
      </TagFilterProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('TaskGridRow', () => {
  it('renders the task title', () => {
    renderRow(makeTask())
    expect(screen.getAllByText('Task title').length).toBeGreaterThan(0)
  })

  it('renders the task number', () => {
    renderRow(makeTask({ number: 42 }))
    expect(screen.getAllByText('#42').length).toBeGreaterThan(0)
  })

  it('renders a parent reference when parentNumber is set', () => {
    renderRow(makeTask({ parentNumber: 7 }))
    expect(screen.getAllByText('← #7').length).toBeGreaterThan(0)
  })

  it('does not render a parent reference when parentNumber is null', () => {
    renderRow(makeTask({ parentNumber: null }))
    expect(screen.queryByText(/← #/)).not.toBeInTheDocument()
  })

  it('does not render tag tokens when there are no labels', () => {
    renderRow(makeTask({ labels: [] }))
    // Tag tokens render as buttons; the task number label (a <span>) also
    // starts with "#", so scope the query to buttons to avoid a false match.
    expect(screen.queryByRole('button', { name: /^#/ })).not.toBeInTheDocument()
  })

  it('renders a token per label', () => {
    renderRow(makeTask({ labels: ['dev:tq', 'chore'] }))
    expect(screen.getAllByText('#dev:tq').length).toBeGreaterThan(0)
    expect(screen.getAllByText('#chore').length).toBeGreaterThan(0)
  })

  it('sets the tag filter and stops the click from reaching the row Link when a tag token is clicked', async () => {
    const user = userEvent.setup()
    renderRow(makeTask({ labels: ['dev:tq'] }))

    expect(screen.getByTestId('tag-probe')).toHaveTextContent('none')

    await user.click(atIndex(screen.getAllByText('#dev:tq'), 0))

    expect(screen.getByTestId('tag-probe')).toHaveTextContent('dev:tq')
    expect(mockLinkOnClick).not.toHaveBeenCalled()
  })

  it('lets a click bubble to the row Link when clicking elsewhere in the row', async () => {
    // Control for the tag-token test above: proves mockLinkOnClick actually
    // observes bubbled clicks, so its absence there means something.
    const user = userEvent.setup()
    renderRow(makeTask({ labels: ['dev:tq'] }))

    await user.click(atIndex(screen.getAllByText('Task title'), 0))

    expect(mockLinkOnClick).toHaveBeenCalled()
  })

  it('does not show a GitHub badge when there is no link', () => {
    renderRow(makeTask())
    expect(screen.queryByText('tq#42')).not.toBeInTheDocument()
  })

  it('shows a GitHub badge when linked', () => {
    renderRow(
      makeTask({
        githubLink: {
          id: 'link-1',
          owner: 'fohte',
          repo: 'tq',
          number: 42,
          kind: 'issue',
          url: 'https://github.com/fohte/tq/issues/42',
          state: 'open',
          title: 'Linked issue',
          lastSyncedAt: '2026-03-20T00:00:00.000Z',
        },
      }),
    )
    expect(screen.getAllByText('tq#42').length).toBeGreaterThan(0)
  })

  it('highlights an overdue due date', () => {
    renderRow(makeTask({ dueDate: '2020-01-01' }))
    const badge = atIndex(screen.getAllByText('Jan 1, 2020'), 0)
    expect(badge).toHaveClass('text-primary')
  })

  it('does not highlight a completed task even when the due date has passed', () => {
    renderRow(makeTask({ status: 'completed', dueDate: '2020-01-01' }))
    const badge = atIndex(screen.getAllByText('Jan 1, 2020'), 0)
    expect(badge).not.toHaveClass('text-primary')
  })

  it('updates the status via useUpdateTaskStatus when a non-completed status is selected', async () => {
    const user = userEvent.setup()
    renderRow(makeTask({ status: 'todo' }))

    await user.click(atIndex(screen.getAllByText('Set In Progress'), 0))

    expect(mockUpdateStatusMutate).toHaveBeenCalledWith({
      id: 'task-1',
      status: 'in_progress',
    })
    expect(mockMutate).not.toHaveBeenCalled()
  })

  it('completes the task via useCompleteTask when completed is selected', async () => {
    const user = userEvent.setup()
    renderRow(makeTask({ status: 'todo' }))

    await user.click(atIndex(screen.getAllByText('Set Completed'), 0))

    expect(mockMutate).toHaveBeenCalledWith('task-1')
    expect(mockUpdateStatusMutate).not.toHaveBeenCalled()
  })

  it('does nothing when the currently selected status is chosen again', async () => {
    const user = userEvent.setup()
    renderRow(makeTask({ status: 'todo' }))

    await user.click(atIndex(screen.getAllByText('Set Todo'), 0))

    expect(mockMutate).not.toHaveBeenCalled()
    expect(mockUpdateStatusMutate).not.toHaveBeenCalled()
  })
})
