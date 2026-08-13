import type { RefObject } from 'react'

import { AnchoredPopup } from '#components/ui/anchored-popup'
import type { SuggestionItem, TriggerChar } from '#lib/task-input-parser'
import { cn } from '#lib/utils'

export function CreateTaskInlineSuggestionMenu({
  anchor,
  open,
  onOpenChange,
  trigger,
  suggestions,
  selectedIndex,
  onSelectSuggestion,
}: {
  anchor: RefObject<HTMLInputElement | null>
  open: boolean
  onOpenChange: (open: boolean) => void
  trigger: TriggerChar | undefined
  suggestions: SuggestionItem[]
  selectedIndex: number
  onSelectSuggestion: (item: SuggestionItem) => void
}) {
  return (
    <AnchoredPopup
      open={open}
      onOpenChange={onOpenChange}
      anchor={anchor}
      // The popup opens while the input keeps typing focus — Base UI's
      // default initial-focus behavior would otherwise steal focus onto the
      // first suggestion button and break arrow-key navigation.
      initialFocus={false}
      className="w-48 font-sans"
    >
      {suggestions.map((item, index) => (
        <button
          key={item.value}
          type="button"
          className={cn(
            'w-full px-3 py-1.5 text-left text-sm',
            index === selectedIndex
              ? 'bg-accent text-accent-foreground'
              : 'text-popover-foreground hover:bg-accent/50',
          )}
          onMouseDown={(e) => {
            e.preventDefault()
            onSelectSuggestion(item)
          }}
        >
          {trigger}
          {item.display}
        </button>
      ))}
    </AnchoredPopup>
  )
}
