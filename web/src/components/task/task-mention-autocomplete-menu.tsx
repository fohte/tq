import { useEffect, useSyncExternalStore } from 'react'

import { TaskMentionSummary } from '#components/task/task-mention-summary'
import { Button } from '#components/ui/button'
import {
  type MentionSuggestion,
  useTaskMentionSuggestions,
} from '#hooks/use-task-mentions'
import type { MentionAutocompleteStore } from '#lib/inline-reference/providers/task-mention-autocomplete-store'
import { cn } from '#lib/utils'

const menuClassName =
  'w-64 bg-popover p-1 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10'

export function TaskMentionAutocompleteMenuAppearance({
  items,
  highlightedIndex,
  onSelect,
  onHighlightedIndexChange,
}: {
  items: MentionSuggestion[]
  highlightedIndex: number
  onSelect: (item: MentionSuggestion) => void
  onHighlightedIndexChange: (index: number) => void
}) {
  return (
    <ul className={menuClassName}>
      {items.length === 0 ? (
        <li className="px-2 py-1.5 text-muted-foreground">No matching tasks</li>
      ) : (
        items.map((item, index) => (
          <li key={item.id}>
            <Button
              type="button"
              variant="ghost"
              className={cn(
                'h-auto min-h-0 shrink whitespace-normal gap-0 rounded-none border-0 bg-transparent p-0 font-inherit font-normal shadow-none transition-none hover:bg-transparent active:translate-y-0',
                'flex w-full items-center justify-start gap-2 px-2 py-1.5 text-left',
                index === highlightedIndex &&
                  'bg-accent text-accent-foreground',
              )}
              onMouseEnter={() => {
                onHighlightedIndexChange(index)
              }}
              onClick={() => {
                onSelect(item)
              }}
            >
              <TaskMentionSummary
                status={item.status}
                number={item.number}
                title={item.title}
                ignoreAncestorSvgSizing
              />
            </Button>
          </li>
        ))
      )}
    </ul>
  )
}

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
