import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TaskGridRow } from '#components/task/task-grid-row'
import { makeTask } from '#components/task/task-row-test-fixtures'
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
// Not shared with the other row test files: vi.mock factories are hoisted
// above imports, so a shared factory couldn't close over anything defined
// after the mock call, and vi.mock itself must stay inline per-file.
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

// The component renders a desktop grid and a mobile stack simultaneously
// (CSS media queries choose which is visible; jsdom has no viewport so both
// are queryable). Assertions below pin the count to 2 rather than just
// "at least one" so a regression in either layout alone still fails.
describe('TaskGridRow', () => {
  it('renders the task title', () => {
    renderRow(makeTask())
    expect(screen.getAllByText('Task title')).toHaveLength(2)
  })

  it('renders the task number', () => {
    renderRow(makeTask({ number: 42 }))
    expect(screen.getAllByText('#42')).toHaveLength(2)
  })

  it('renders a parent reference when parentNumber is set', () => {
    renderRow(makeTask({ parentNumber: 7 }))
    // The parent reference only appears in the desktop title cell — the
    // mobile meta row has no room for it.
    expect(screen.getAllByText('← #7')).toHaveLength(1)
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
    // Desktop and mobile layouts both render, so each label's token appears
    // twice, in layout order.
    expect(
      screen.getAllByRole('button', { name: /^#/ }).map((el) => el.textContent),
    ).toEqual(['#dev:tq', '#chore', '#dev:tq', '#chore'])
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
    // The LINK column only exists in the desktop grid.
    expect(screen.getAllByText('tq#42')).toHaveLength(1)
  })

  it('highlights an overdue due date', () => {
    renderRow(makeTask({ dueDate: '2020-01-01' }))
    const badges = screen.getAllByText('Jan 1, 2020')
    expect(badges.map((b) => b.classList.contains('text-primary'))).toEqual([
      true,
      true,
    ])
  })

  it('does not highlight a completed task even when the due date has passed', () => {
    renderRow(makeTask({ status: 'completed', dueDate: '2020-01-01' }))
    const badges = screen.getAllByText('Jan 1, 2020')
    expect(badges.map((b) => b.classList.contains('text-primary'))).toEqual([
      false,
      false,
    ])
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
