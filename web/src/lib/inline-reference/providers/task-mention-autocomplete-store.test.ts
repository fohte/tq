import { describe, expect, it } from 'vitest'

import type { MentionSuggestion } from '#hooks/use-task-mentions'
import { createMentionAutocompleteStore } from '#lib/inline-reference/providers/task-mention-autocomplete-store'

const item1: MentionSuggestion = {
  id: '1',
  number: 1,
  title: 'First',
  status: 'todo',
}
const item2: MentionSuggestion = {
  id: '2',
  number: 2,
  title: 'Second',
  status: 'todo',
}

describe('createMentionAutocompleteStore', () => {
  it('opens with the given query and range, no items yet', () => {
    const store = createMentionAutocompleteStore()

    store.show('dep', { from: 1, to: 4 })

    expect(store.getSnapshot()).toEqual({
      open: true,
      query: 'dep',
      range: { from: 1, to: 4 },
      items: [],
      highlightedIndex: 0,
    })
  })

  it('does not reset items or the highlighted index when shown again with the same query and range', () => {
    const store = createMentionAutocompleteStore()

    store.show('dep', { from: 1, to: 4 })
    store.setItems([item1, item2])
    store.setHighlightedIndex(1)
    store.show('dep', { from: 1, to: 4 })

    expect(store.getSnapshot()).toEqual({
      open: true,
      query: 'dep',
      range: { from: 1, to: 4 },
      items: [item1, item2],
      highlightedIndex: 1,
    })
  })

  it('resets items and the highlighted index when shown with a different query', () => {
    const store = createMentionAutocompleteStore()

    store.show('dep', { from: 1, to: 4 })
    store.setItems([item1, item2])
    store.setHighlightedIndex(1)
    store.show('depl', { from: 1, to: 5 })

    expect(store.getSnapshot()).toEqual({
      open: true,
      query: 'depl',
      range: { from: 1, to: 5 },
      items: [],
      highlightedIndex: 0,
    })
  })

  it('clamps the highlighted index down when the item list shrinks', () => {
    const store = createMentionAutocompleteStore()

    store.show('dep', { from: 1, to: 4 })
    store.setItems([item1, item2])
    store.setHighlightedIndex(1)
    store.setItems([item1])

    expect(store.getSnapshot().highlightedIndex).toBe(0)
  })

  it('wraps the highlight around in both directions', () => {
    const store = createMentionAutocompleteStore()

    store.show('dep', { from: 1, to: 4 })
    store.setItems([item1, item2])

    store.moveHighlight(-1)
    expect(store.getSnapshot().highlightedIndex).toBe(1)

    store.moveHighlight(1)
    expect(store.getSnapshot().highlightedIndex).toBe(0)
  })

  it('closes back to the initial closed state', () => {
    const store = createMentionAutocompleteStore()

    store.show('dep', { from: 1, to: 4 })
    store.setItems([item1])
    store.hide()

    expect(store.getSnapshot()).toEqual({
      open: false,
      query: '',
      range: null,
      items: [],
      highlightedIndex: 0,
    })
  })

  it('returns the item at the highlighted index', () => {
    const store = createMentionAutocompleteStore()

    store.show('dep', { from: 1, to: 4 })
    store.setItems([item1, item2])
    store.setHighlightedIndex(1)

    expect(store.highlightedItem()).toEqual(item2)
  })
})
