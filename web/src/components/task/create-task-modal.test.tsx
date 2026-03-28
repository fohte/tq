import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CreateTaskModal } from '@web/components/task/create-task-modal'
import { atIndex } from '@web/lib/test-utils'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@web/components/ui/markdown-editor', () => ({
  MarkdownEditor: ({
    placeholder,
    onChange,
  }: {
    placeholder?: string
    onChange?: (md: string) => void
  }) => (
    <textarea
      data-testid="mock-markdown-editor"
      placeholder={placeholder}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
}))

function renderModal(
  props: { open?: boolean; onOpenChange?: () => void } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const onOpenChange = props.onOpenChange ?? vi.fn()

  return render(
    <QueryClientProvider client={queryClient}>
      <CreateTaskModal open={props.open ?? true} onOpenChange={onOpenChange} />
    </QueryClientProvider>,
  )
}

describe('CreateTaskModal', () => {
  it('renders the modal title when open', () => {
    renderModal()
    expect(screen.getAllByText('New Task').length).toBeGreaterThan(0)
  })

  it('disables create buttons when title is empty', () => {
    renderModal()
    const createButtons = screen.getAllByRole('button', { name: /create/i })
    for (const btn of createButtons) {
      expect(btn).toBeDisabled()
    }
  })

  it('enables create buttons after entering a title', async () => {
    const user = userEvent.setup()
    renderModal()

    const titleInputs =
      screen.getAllByPlaceholderText(/task title|タスクのタイトル/i)
    await user.type(atIndex(titleInputs, 0), 'Test task')

    const createButtons = screen.getAllByRole('button', { name: /create/i })
    const enabledButton = createButtons.find(
      (btn) => !btn.hasAttribute('disabled'),
    )
    expect(enabledButton).toBeDefined()
  })
})
