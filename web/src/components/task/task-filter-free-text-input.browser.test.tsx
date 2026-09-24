import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps, ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { makeSuggestion } from '#components/search/search-test-fixtures'
import { TaskFilterFreeTextInput } from '#components/task/task-filter-free-text-input'
import type { Suggestion } from '#hooks/use-search'

const suggestionFixtures: Suggestion[] = [
  makeSuggestion(),
  makeSuggestion({ value: 'is:completed', display: 'Completed' }),
]

let mockSuggestionData: Suggestion[] = []

vi.mock('#hooks/use-search', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#hooks/use-search')>()
  return {
    ...actual,
    useSearchSuggestions: () => ({
      data: mockSuggestionData.length > 0 ? mockSuggestionData : undefined,
    }),
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

function renderInput(
  props: Partial<ComponentProps<typeof TaskFilterFreeTextInput>> = {},
) {
  const onCommit = props.onCommit ?? vi.fn()
  const onBackspaceEmpty = props.onBackspaceEmpty ?? vi.fn()
  return {
    onCommit,
    onBackspaceEmpty,
    ...render(
      <TaskFilterFreeTextInput
        id="free-text"
        freeText=""
        onCommit={onCommit}
        onBackspaceEmpty={onBackspaceEmpty}
        {...props}
      />,
      { wrapper: Wrapper },
    ),
  }
}

describe('TaskFilterFreeTextInput', () => {
  beforeEach(() => {
    mockSuggestionData = []
  })

  it('keeps focus on the input while the suggestion popup is shown', async () => {
    mockSuggestionData = suggestionFixtures
    const user = userEvent.setup()
    renderInput()

    const input = screen.getByRole('textbox', { name: 'Filter query' })
    await user.type(input, 'is:')

    expect(screen.getByText('is:todo')).toBeInTheDocument()
    expect(input).toHaveFocus()
  })

  it('applies the highlighted suggestion on Tab', async () => {
    mockSuggestionData = suggestionFixtures
    const user = userEvent.setup()
    renderInput()

    const input = screen.getByRole('textbox', { name: 'Filter query' })
    await user.type(input, 'is:')
    await user.keyboard('{Tab}')

    expect(input).toHaveValue('is:todo ')
  })

  it('commits on Enter when there are no suggestions', async () => {
    const user = userEvent.setup()
    const { onCommit } = renderInput({ freeText: 'sort:updated' })

    const input = screen.getByRole('textbox', { name: 'Filter query' })
    // Overwrite the whole value instead of appending, so the result doesn't
    // depend on where the browser places the caret after a click.
    await user.clear(input)
    await user.type(input, 'sort:updated has:pages')
    await user.keyboard('{Enter}')

    expect(onCommit).toHaveBeenCalledWith('sort:updated has:pages')
    // The committed text fully parses into structured fields, so the box
    // clears immediately rather than waiting for `freeText` to round-trip
    // back down as a prop.
    expect(input).toHaveValue('')
  })

  it('resets to the last freeText on Escape without committing', async () => {
    const user = userEvent.setup()
    const { onCommit } = renderInput({ freeText: 'sort:updated' })

    const input = screen.getByRole('textbox', { name: 'Filter query' })
    await user.clear(input)
    await user.type(input, 'sort:updated has:pages')
    await user.keyboard('{Escape}')

    expect(input).toHaveValue('sort:updated')
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('does not commit on blur without a change', async () => {
    const user = userEvent.setup()
    const { onCommit } = renderInput({ freeText: 'sort:updated' })

    const input = screen.getByRole('textbox', { name: 'Filter query' })
    await user.click(input)
    await user.tab()

    expect(onCommit).not.toHaveBeenCalled()
  })

  it('commits on blur after a change', async () => {
    const user = userEvent.setup()
    const { onCommit } = renderInput({ freeText: 'sort:updated' })

    const input = screen.getByRole('textbox', { name: 'Filter query' })
    await user.clear(input)
    await user.type(input, 'sort:updated has:pages')
    await user.tab()

    expect(onCommit).toHaveBeenCalledWith('sort:updated has:pages')
  })

  it('notifies the parent on Backspace when already empty', async () => {
    const user = userEvent.setup()
    const { onBackspaceEmpty } = renderInput({ freeText: '' })

    const input = screen.getByRole('textbox', { name: 'Filter query' })
    await user.click(input)
    await user.keyboard('{Backspace}')

    expect(onBackspaceEmpty).toHaveBeenCalled()
  })

  it('does not notify the parent on Backspace when there is still text', async () => {
    const user = userEvent.setup()
    const { onBackspaceEmpty } = renderInput({ freeText: 'hello' })

    const input = screen.getByRole('textbox', { name: 'Filter query' })
    await user.click(input)
    await user.keyboard('{Backspace}')

    expect(onBackspaceEmpty).not.toHaveBeenCalled()
  })

  it('preserves an unsent edit while focused through an external freeText change', async () => {
    const user = userEvent.setup()
    const { onCommit, onBackspaceEmpty, rerender } = renderInput({
      freeText: '',
    })

    const input = screen.getByRole('textbox', { name: 'Filter query' })
    await user.click(input)
    await user.type(input, 'typing')

    // Simulates a chip removed elsewhere in the filter row, which lifts a
    // new `freeText` back down as a prop while this field is still focused.
    rerender(
      <TaskFilterFreeTextInput
        id="free-text"
        freeText="external-change"
        onCommit={onCommit}
        onBackspaceEmpty={onBackspaceEmpty}
      />,
    )

    expect(input).toHaveValue('typing')
  })

  it('applies an external freeText change when not focused', () => {
    const { onCommit, onBackspaceEmpty, rerender } = renderInput({
      freeText: '',
    })

    rerender(
      <TaskFilterFreeTextInput
        id="free-text"
        freeText="external-change"
        onCommit={onCommit}
        onBackspaceEmpty={onBackspaceEmpty}
      />,
    )

    expect(screen.getByRole('textbox', { name: 'Filter query' })).toHaveValue(
      'external-change',
    )
  })
})
