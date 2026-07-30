import { useEffect, useSyncExternalStore } from 'react'

import { TaskMentionSummary } from '#components/task/task-mention-summary'
import {
  type MentionSuggestion,
  useTaskMentionSuggestions,
} from '#hooks/use-task-mentions'
import type { MentionAutocompleteStore } from '#lib/inline-reference/providers/task-mention-autocomplete-store'
import { cn } from '#lib/utils'

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

  return (
    <ul className="w-64 rounded-lg border border-border bg-background p-1 text-sm shadow-md">
      {isLoading ? (
        <li className="px-2 py-1.5 text-muted-foreground">Searching...</li>
      ) : state.items.length === 0 ? (
        <li className="px-2 py-1.5 text-muted-foreground">No matching tasks</li>
      ) : (
        state.items.map((item, index) => (
          <li key={item.id}>
            <button
              type="button"
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left',
                index === state.highlightedIndex && 'bg-secondary',
              )}
              onMouseEnter={() => {
                store.setHighlightedIndex(index)
              }}
              onClick={() => {
                onSelect(item)
              }}
            >
              <TaskMentionSummary
                status={item.status}
                number={item.number}
                title={item.title}
              />
            </button>
          </li>
        ))
      )}
    </ul>
  )
}
