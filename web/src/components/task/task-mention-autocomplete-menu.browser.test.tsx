import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TaskMentionAutocompleteMenu } from '#components/task/task-mention-autocomplete-menu'
import { makeMentionSuggestion } from '#components/task/task-mention-test-fixtures'
import type { MentionSuggestion } from '#hooks/use-task-mentions'
import { createMentionAutocompleteStore } from '#lib/inline-reference/providers/task-mention-autocomplete-store'

let mockSuggestions: MentionSuggestion[] | undefined

vi.mock('#hooks/use-task-mentions', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('#hooks/use-task-mentions')>()
  return {
    ...actual,
    useTaskMentionSuggestions: () => ({
      data: mockSuggestions,
      isLoading: false,
    }),
  }
})

function renderMenu() {
  const store = createMentionAutocompleteStore()
  store.show('dep', { from: 0, to: 3 })
  const onSelect = vi.fn()

  render(<TaskMentionAutocompleteMenu store={store} onSelect={onSelect} />)

  return { store, onSelect }
}

describe('TaskMentionAutocompleteMenu', () => {
  beforeEach(() => {
    mockSuggestions = undefined
  })

  it('calls onSelect with the clicked item', async () => {
    const secondItem = makeMentionSuggestion({
      id: '2',
      number: 120,
      title: 'Deploy docs site',
    })
    mockSuggestions = [makeMentionSuggestion(), secondItem]
    const user = userEvent.setup()
    const { onSelect } = renderMenu()

    await user.click(
      await screen.findByRole('button', { name: /Deploy docs site/ }),
    )

    expect(onSelect).toHaveBeenCalledWith(secondItem)
  })

  it('highlights the hovered item in the store', async () => {
    mockSuggestions = [
      makeMentionSuggestion(),
      makeMentionSuggestion({
        id: '2',
        number: 120,
        title: 'Deploy docs site',
      }),
    ]
    const user = userEvent.setup()
    const { store } = renderMenu()

    await user.hover(
      await screen.findByRole('button', { name: /Deploy docs site/ }),
    )

    expect(store.getSnapshot().highlightedIndex).toBe(1)
  })

  // Arrow-key handling lives in the ProseMirror plugin outside this
  // component, driving highlightedIndex through the store directly rather
  // than through a DOM event this component dispatches.
  it('reflects a highlightedIndex pushed to the store directly', async () => {
    mockSuggestions = [
      makeMentionSuggestion(),
      makeMentionSuggestion({
        id: '2',
        number: 120,
        title: 'Deploy docs site',
      }),
    ]
    const { store } = renderMenu()
    await screen.findByRole('button', { name: /Deploy docs site/ })

    act(() => {
      store.moveHighlight(1)
    })

    expect(
      screen.getByRole('button', { name: /Deploy docs site/ }),
    ).toHaveClass('bg-accent')
  })

  it('falls back to the no-results state when the suggestions fetch fails', async () => {
    mockSuggestions = undefined
    const { store } = renderMenu()

    await screen.findByText('No matching tasks')

    expect(store.getSnapshot()).toEqual({
      open: true,
      query: 'dep',
      range: { from: 0, to: 3 },
      items: [],
      highlightedIndex: 0,
    })
  })
})
