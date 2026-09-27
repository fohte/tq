import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { TaskActivity } from '#components/task/task-activity'
import { makeComment } from '#components/task/task-activity-test-fixtures'
import type { ActivityItem } from '#hooks/use-task-activity'
import { useTaskActivity } from '#hooks/use-task-activity'
import type { Comment } from '#hooks/use-task-comments'
import {
  useCreateComment,
  useDeleteComment,
  useTaskComments,
  useUpdateComment,
} from '#hooks/use-task-comments'

vi.mock('#components/ui/markdown-editor', () => ({
  MarkdownEditor: ({
    defaultValue,
    placeholder,
    onChange,
    editing,
    onEditingChange,
    onExitEditMode,
  }: {
    defaultValue?: string
    placeholder?: string
    editing?: boolean
    onEditingChange?: (editing: boolean) => void
    onChange?: (md: string) => void
    onExitEditMode?: () => void
  }) => (
    <textarea
      data-testid="mock-markdown-editor"
      data-editing={String(editing === true)}
      defaultValue={defaultValue}
      placeholder={placeholder}
      onChange={(e) => onChange?.(e.target.value)}
      onBlur={() => {
        if (editing !== true) return
        onExitEditMode?.()
        onEditingChange?.(false)
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Escape' || editing !== true) return
        onExitEditMode?.()
        onEditingChange?.(false)
      }}
    />
  ),
}))

vi.mock('#hooks/use-task-comments', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('#hooks/use-task-comments')>()
  return {
    ...original,
    useTaskComments: vi.fn(),
    useCreateComment: vi.fn(),
    useUpdateComment: vi.fn(),
    useDeleteComment: vi.fn(),
  }
})

vi.mock('#hooks/use-task-activity', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('#hooks/use-task-activity')>()
  return {
    ...original,
    useTaskActivity: vi.fn(),
  }
})

const mockUseTaskComments = vi.mocked(useTaskComments)
const mockUseCreateComment = vi.mocked(useCreateComment)
const mockUseUpdateComment = vi.mocked(useUpdateComment)
const mockUseDeleteComment = vi.mocked(useDeleteComment)
const mockUseTaskActivity = vi.mocked(useTaskActivity)

function makeCreatedEvent(
  overrides: Partial<Extract<ActivityItem, { type: 'created' }>> = {},
): ActivityItem {
  return {
    id: 'event-created',
    type: 'created',
    createdAt: '2026-03-20T08:00:00.000Z',
    author: { kind: 'human', agent: null },
    ...overrides,
  }
}

function makeStatusChangedEvent(
  overrides: Partial<Extract<ActivityItem, { type: 'status_changed' }>> = {},
): ActivityItem {
  return {
    id: 'event-status',
    type: 'status_changed',
    createdAt: '2026-03-20T09:00:00.000Z',
    author: { kind: 'human', agent: null },
    fromStatus: 'todo',
    toStatus: 'in_progress',
    toStatusReason: null,
    ...overrides,
  }
}

function makeGithubLinkedEvent(
  overrides: Partial<
    Extract<ActivityItem, { type: 'github_linked' | 'github_unlinked' }>
  > = {},
): ActivityItem {
  return {
    id: 'event-linked',
    type: 'github_linked',
    createdAt: '2026-03-20T09:30:00.000Z',
    author: { kind: 'human', agent: null },
    owner: 'fohte',
    repo: 'tq',
    number: 42,
    kind: 'issue',
    ...overrides,
  }
}

function setupMocks({
  comments = [],
  events = [],
  commentsLoading = false,
  eventsLoading = false,
}: {
  comments?: Comment[]
  events?: ActivityItem[]
  commentsLoading?: boolean
  eventsLoading?: boolean
} = {}) {
  const createMutate = vi.fn()
  const updateMutate = vi.fn()
  const deleteMutate = vi.fn()

  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- partial mock of hook return value
  mockUseTaskComments.mockReturnValue({
    data: comments,
    isLoading: commentsLoading,
  } as ReturnType<typeof useTaskComments>)

  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- partial mock of hook return value
  mockUseTaskActivity.mockReturnValue({
    data: events,
    isLoading: eventsLoading,
  } as ReturnType<typeof useTaskActivity>)

  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- partial mock of hook return value
  mockUseCreateComment.mockReturnValue({
    mutate: createMutate,
    isPending: false,
  } as unknown as ReturnType<typeof useCreateComment>)

  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- partial mock of hook return value
  mockUseUpdateComment.mockReturnValue({
    mutate: updateMutate,
  } as unknown as ReturnType<typeof useUpdateComment>)

  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- partial mock of hook return value
  mockUseDeleteComment.mockReturnValue({
    mutate: deleteMutate,
  } as unknown as ReturnType<typeof useDeleteComment>)

  return { createMutate, updateMutate, deleteMutate }
}

function renderActivity(taskId = 'task-1') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <TaskActivity taskId={taskId} />
    </QueryClientProvider>,
  )
}

function getEditorSaveResult(editor: HTMLElement, updateCalls: unknown) {
  return {
    editing: editor.getAttribute('data-editing'),
    updateCalls,
  }
}

function getDeleteResult(
  confirmationShown: boolean,
  deleteCallsBeforeConfirmation: number,
  deleteCalls: unknown,
) {
  return {
    confirmationShown,
    deleteCallsBeforeConfirmation,
    deleteCalls,
  }
}

describe('TaskActivity', () => {
  it('shows empty state when there is no activity', () => {
    setupMocks({ comments: [], events: [] })
    renderActivity()
    expect(screen.getByText(/no activity yet/i)).toBeInTheDocument()
  })

  it('displays comments in order', () => {
    const comments = [
      makeComment({
        id: 'c1',
        content: 'First comment',
        createdAt: '2026-03-20T09:00:00.000Z',
      }),
      makeComment({
        id: 'c2',
        content: 'Second comment',
        createdAt: '2026-03-20T10:00:00.000Z',
      }),
      makeComment({
        id: 'c3',
        content: 'Third comment',
        createdAt: '2026-03-20T11:00:00.000Z',
      }),
    ]
    setupMocks({ comments })
    renderActivity()

    expect(screen.getByText('First comment')).toBeInTheDocument()
    expect(screen.getByText('Second comment')).toBeInTheDocument()
    expect(screen.getByText('Third comment')).toBeInTheDocument()

    // Verify order: First should appear before Second, which appears before Third
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- textContent can be null at runtime
    const allText = document.body.textContent ?? ''
    const firstIdx = allText.indexOf('First comment')
    const secondIdx = allText.indexOf('Second comment')
    const thirdIdx = allText.indexOf('Third comment')
    expect(firstIdx).toBeLessThan(secondIdx)
    expect(secondIdx).toBeLessThan(thirdIdx)
  })

  it('shows (edited) for updated comments', () => {
    const comment = makeComment({
      createdAt: '2026-03-20T10:00:00.000Z',
      updatedAt: '2026-03-20T11:00:00.000Z',
    })
    setupMocks({ comments: [comment] })
    renderActivity()

    expect(screen.getByText('commented (edited)')).toBeInTheDocument()
  })

  it('renders a created event', () => {
    setupMocks({ events: [makeCreatedEvent()] })
    renderActivity()

    expect(screen.getByText('created this task')).toBeInTheDocument()
  })

  it('renders a status_changed event with statuses as-is', () => {
    setupMocks({
      events: [
        makeStatusChangedEvent({ fromStatus: 'todo', toStatus: 'in_progress' }),
      ],
    })
    renderActivity()

    expect(
      screen.getByText('changed status todo → in_progress'),
    ).toBeInTheDocument()
  })

  it('renders a github_linked event', () => {
    setupMocks({ events: [makeGithubLinkedEvent()] })
    renderActivity()

    expect(screen.getByText('linked fohte/tq#42')).toBeInTheDocument()
  })

  it('renders a github_unlinked event', () => {
    setupMocks({
      events: [makeGithubLinkedEvent({ type: 'github_unlinked' })],
    })
    renderActivity()

    expect(screen.getByText('unlinked fohte/tq#42')).toBeInTheDocument()
  })

  it('merges comments and events into a single chronological timeline', () => {
    const comments = [
      makeComment({
        id: 'c1',
        content: 'Middle comment',
        createdAt: '2026-03-20T09:15:00.000Z',
      }),
    ]
    const events = [
      makeCreatedEvent({ createdAt: '2026-03-20T08:00:00.000Z' }),
      makeStatusChangedEvent({ createdAt: '2026-03-20T10:00:00.000Z' }),
    ]
    setupMocks({ comments, events })
    renderActivity()

    const allText = document.body.textContent
    const createdIdx = allText.indexOf('created this task')
    const commentIdx = allText.indexOf('Middle comment')
    const statusIdx = allText.indexOf('changed status todo → in_progress')

    expect(createdIdx).toBeLessThan(commentIdx)
    expect(commentIdx).toBeLessThan(statusIdx)
  })

  it('keeps a comment in view mode when its body is clicked', async () => {
    const user = userEvent.setup()
    const comment = makeComment({ content: 'Test comment' })
    setupMocks({ comments: [comment] })
    renderActivity()

    const editor = screen.getByDisplayValue(comment.content)
    await user.click(editor)

    expect(editor.getAttribute('data-editing')).toBe('false')
  })

  it('enters edit mode from the comment actions menu', async () => {
    const user = userEvent.setup()
    const comment = makeComment({ content: 'Test comment' })
    setupMocks({ comments: [comment] })
    renderActivity()

    await user.click(screen.getByRole('button', { name: 'Comment actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Edit' }))

    expect(
      screen.getByDisplayValue(comment.content).getAttribute('data-editing'),
    ).toBe('true')
  })

  it('saves edited comment content when Escape exits edit mode', async () => {
    const user = userEvent.setup()
    const comment = makeComment({ content: 'Test comment' })
    const { updateMutate } = setupMocks({ comments: [comment] })
    renderActivity()

    await user.click(screen.getByRole('button', { name: 'Comment actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Edit' }))

    const editor = screen.getByDisplayValue(comment.content)
    await user.clear(editor)
    await user.type(editor, ' Updated comment ')
    await user.keyboard('{Escape}')

    expect(getEditorSaveResult(editor, updateMutate.mock.calls)).toEqual({
      editing: 'false',
      updateCalls: [[{ commentId: comment.id, content: 'Updated comment' }]],
    })
  })

  it('deletes a comment only after confirming from the actions menu', async () => {
    const user = userEvent.setup()
    const comment = makeComment()
    const { deleteMutate } = setupMocks({ comments: [comment] })
    renderActivity()

    await user.click(screen.getByRole('button', { name: 'Comment actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    const confirmation = await screen.findByText(
      'Are you sure you want to delete this comment? This action cannot be undone.',
    )
    const confirmationShown = confirmation.isConnected
    const deleteCallsBeforeConfirmation = deleteMutate.mock.calls.length

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(
      getDeleteResult(
        confirmationShown,
        deleteCallsBeforeConfirmation,
        deleteMutate.mock.calls,
      ),
    ).toEqual({
      confirmationShown: true,
      deleteCallsBeforeConfirmation: 0,
      deleteCalls: [[comment.id]],
    })
  })

  it('submits a new comment', async () => {
    const user = userEvent.setup()
    const { createMutate } = setupMocks({ comments: [] })
    renderActivity()

    const editor = screen.getByPlaceholderText(/add a comment/i)
    await user.type(editor, 'New comment text')

    const submitButton = screen.getByRole('button', { name: /comment/i })
    await user.click(submitButton)

    expect(createMutate).toHaveBeenCalledWith('New comment text')
  })

  it('disables submit button when input is empty', () => {
    setupMocks({ comments: [] })
    renderActivity()

    const submitButton = screen.getByRole('button', { name: /comment/i })
    expect(submitButton).toBeDisabled()
  })

  it('shows loading state while comments are loading', () => {
    setupMocks({ commentsLoading: true })
    renderActivity()

    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('shows loading state while activity events are loading', () => {
    setupMocks({ eventsLoading: true })
    renderActivity()

    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('shows activity heading', () => {
    setupMocks({ comments: [] })
    renderActivity()

    expect(screen.getByText('activity')).toBeInTheDocument()
  })
})
