import { useEffect, useSyncExternalStore } from 'react'

import {
  menuClassName,
  TaskMentionAutocompleteMenuAppearance,
} from '#components/task/task-mention-autocomplete-menu-appearance'
import {
  type MentionSuggestion,
  useTaskMentionSuggestions,
} from '#hooks/use-task-mentions'
import type { MentionAutocompleteStore } from '#lib/inline-reference/providers/task-mention-autocomplete-store'

export function TaskMentionAutocompleteMenu({
  store,
  onSelect,
}: {
  store: MentionAutocompleteStore
  onSelect: (item: MentionSuggestion) => void
}) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const { data, isLoading } = useTaskMentionSuggestions(state.query, state.open)

  useEffect(() => {
    if (data != null) store.setItems(data)
  }, [data, store])

  if (!state.open) return null

  if (isLoading) {
    return (
      <ul className={menuClassName}>
        <li className="px-2 py-1.5 text-muted-foreground">Searching...</li>
      </ul>
    )
  }

  return (
    <TaskMentionAutocompleteMenuAppearance
      items={state.items}
      highlightedIndex={state.highlightedIndex}
      onSelect={onSelect}
      onHighlightedIndexChange={(index) => {
        store.setHighlightedIndex(index)
      }}
    />
  )
}
