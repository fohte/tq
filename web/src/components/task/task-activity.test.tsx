import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TaskActivity } from '@web/components/task/task-activity'
import type { Comment } from '@web/hooks/use-task-comments'
import {
  useCreateComment,
  useDeleteComment,
  useTaskComments,
  useUpdateComment,
} from '@web/hooks/use-task-comments'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@web/components/ui/markdown-editor', () => ({
  MarkdownEditor: ({
    defaultValue,
    placeholder,
    onChange,
  }: {
    defaultValue?: string
    placeholder?: string
    onChange?: (md: string) => void
  }) => {
    if (onChange) {
      return (
        <textarea
          data-testid="mock-markdown-editor"
          defaultValue={defaultValue}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    }
    return <div data-testid="mock-markdown-viewer">{defaultValue}</div>
  },
}))

vi.mock('@web/hooks/use-task-comments', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('@web/hooks/use-task-comments')>()
  return {
    ...original,
    useTaskComments: vi.fn(),
    useCreateComment: vi.fn(),
    useUpdateComment: vi.fn(),
    useDeleteComment: vi.fn(),
  }
})

const mockUseTaskComments = vi.mocked(useTaskComments)
const mockUseCreateComment = vi.mocked(useCreateComment)
const mockUseUpdateComment = vi.mocked(useUpdateComment)
const mockUseDeleteComment = vi.mocked(useDeleteComment)

function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 'comment-1',
    taskId: 'task-1',
    content: 'Test comment',
    createdAt: '2026-03-20T10:00:00.000Z',
    updatedAt: '2026-03-20T10:00:00.000Z',
    ...overrides,
  }
}

function setupMocks({
  comments = [],
  isLoading = false,
}: { comments?: Comment[]; isLoading?: boolean } = {}) {
  const mutateFn = vi.fn()

  mockUseTaskComments.mockReturnValue({
    data: comments,
    isLoading,
  } as ReturnType<typeof useTaskComments>)

  mockUseCreateComment.mockReturnValue({
    mutate: mutateFn,
    isPending: false,
  } as unknown as ReturnType<typeof useCreateComment>)

  mockUseUpdateComment.mockReturnValue({
    mutate: vi.fn(),
  } as unknown as ReturnType<typeof useUpdateComment>)

  mockUseDeleteComment.mockReturnValue({
    mutate: vi.fn(),
  } as unknown as ReturnType<typeof useDeleteComment>)

  return { createMutate: mutateFn }
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

describe('TaskActivity', () => {
  it('shows empty state when no comments exist', () => {
    setupMocks({ comments: [] })
    renderActivity()
    expect(screen.getByText(/no comments yet/i)).toBeInTheDocument()
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

    expect(screen.getByText(/\(edited\)/)).toBeInTheDocument()
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

  it('shows loading state', () => {
    setupMocks({ isLoading: true })
    renderActivity()

    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('shows Activity heading', () => {
    setupMocks({ comments: [] })
    renderActivity()

    expect(screen.getByText('Activity')).toBeInTheDocument()
  })
})
