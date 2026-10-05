import { List, ListItem } from '@fohte/ui/list'

import { TaskMentionSummary } from '#components/task/task-mention-summary'
import type { MentionSuggestion } from '#hooks/use-task-mentions'

export const menuClassName =
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
    <div className={menuClassName}>
      {items.length === 0 ? (
        <div className="px-2 py-1.5 text-muted-foreground">
          No matching tasks
        </div>
      ) : (
        <List role="listbox">
          {items.map((item, index) => (
            <ListItem
              key={item.id}
              highlighted={index === highlightedIndex}
              onMouseEnter={() => {
                onHighlightedIndexChange(index)
              }}
              onSelect={() => {
                onSelect(item)
              }}
            >
              <TaskMentionSummary
                status={item.status}
                statusReason={item.statusReason ?? null}
                number={item.number}
                title={item.title}
              />
            </ListItem>
          ))}
        </List>
      )}
    </div>
  )
}
