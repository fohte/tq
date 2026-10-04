import { Button } from '@fohte/ui/button'

import { TaskMentionSummary } from '#components/task/task-mention-summary'
import type { MentionSuggestion } from '#hooks/use-task-mentions'
import { cn } from '#lib/utils'

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
                statusReason={item.statusReason ?? null}
                number={item.number}
                title={item.title}
              />
            </Button>
          </li>
        ))
      )}
    </ul>
  )
}
