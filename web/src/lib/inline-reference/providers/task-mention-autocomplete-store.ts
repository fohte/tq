import type { MentionSuggestion } from '#hooks/use-task-mentions'

export interface MentionRange {
  from: number
  to: number
}

export interface MentionAutocompleteState {
  open: boolean
  query: string
  range: MentionRange | null
  items: MentionSuggestion[]
  highlightedIndex: number
}

const CLOSED_STATE: MentionAutocompleteState = {
  open: false,
  query: '',
  range: null,
  items: [],
  highlightedIndex: 0,
}

// A small external store (rather than React state) since it's driven from
// inside a ProseMirror plugin, outside of React's render cycle; the
// autocomplete menu subscribes to it via useSyncExternalStore.
export function createMentionAutocompleteStore() {
  let state: MentionAutocompleteState = CLOSED_STATE
  const listeners = new Set<() => void>()

  function set(next: MentionAutocompleteState) {
    state = next
    for (const listener of listeners) listener()
  }

  return {
    getSnapshot: (): MentionAutocompleteState => state,

    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    show(query: string, range: MentionRange) {
      // The plugin calls this on every ProseMirror transaction, including
      // ones unrelated to this mention (e.g. another mention's preview
      // resolving elsewhere in the doc forces a redraw); resetting
      // unconditionally would wipe out an in-progress arrow-key selection.
      if (
        state.open &&
        state.query === query &&
        state.range?.from === range.from &&
        state.range.to === range.to
      ) {
        return
      }
      set({ open: true, query, range, items: [], highlightedIndex: 0 })
    },

    hide() {
      if (!state.open) return
      set(CLOSED_STATE)
    },

    setItems(items: MentionSuggestion[]) {
      if (!state.open) return
      const highlightedIndex = Math.min(
        state.highlightedIndex,
        Math.max(items.length - 1, 0),
      )
      set({ ...state, items, highlightedIndex })
    },

    setHighlightedIndex(index: number) {
      if (!state.open) return
      set({ ...state, highlightedIndex: index })
    },

    moveHighlight(delta: number) {
      if (state.items.length === 0) return
      const next =
        (state.highlightedIndex + delta + state.items.length) %
        state.items.length
      set({ ...state, highlightedIndex: next })
    },

    highlightedItem: (): MentionSuggestion | undefined =>
      state.items[state.highlightedIndex],
  }
}

export type MentionAutocompleteStore = ReturnType<
  typeof createMentionAutocompleteStore
>
