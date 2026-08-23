import { useRef, useState } from 'react'

import { AnchoredPopup } from '#components/ui/anchored-popup'
import type { Suggestion } from '#hooks/use-search'
import {
  applySuggestionToQuery,
  extractCurrentPrefix,
  useSearchSuggestions,
} from '#hooks/use-search'
import { cn } from '#lib/utils'

interface TaskFilterQueryInputProps {
  query: string
  onCommit: (query: string) => void
  onCancel: () => void
}

export function TaskFilterQueryInput({
  query,
  onCommit,
  onCancel,
}: TaskFilterQueryInputProps) {
  const [value, setValue] = useState(query)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const currentPrefix = extractCurrentPrefix(value)
  const { data: suggestions } = useSearchSuggestions(currentPrefix)
  const hasSuggestions =
    suggestions != null && suggestions.length > 0 && currentPrefix.length > 0

  const applySuggestion = (suggestion: Suggestion) => {
    setValue(applySuggestionToQuery(value, suggestion))
    setSelectedIndex(0)
  }

  const commitOrCancel = () => {
    const trimmed = value.trim()
    if (trimmed === query.trim()) {
      onCancel()
    } else {
      onCommit(trimmed)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return

    switch (e.key) {
      case 'ArrowDown':
        if (!hasSuggestions) return
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % suggestions.length)
        break
      case 'ArrowUp':
        if (!hasSuggestions) return
        e.preventDefault()
        setSelectedIndex(
          (prev) => (prev - 1 + suggestions.length) % suggestions.length,
        )
        break
      case 'Tab': {
        if (!hasSuggestions) return
        const selected = suggestions[selectedIndex]
        if (selected == null) return
        e.preventDefault()
        applySuggestion(selected)
        break
      }
      case 'Enter': {
        e.preventDefault()
        const selected = hasSuggestions ? suggestions[selectedIndex] : null
        if (selected != null) {
          applySuggestion(selected)
        } else {
          commitOrCancel()
        }
        break
      }
      case 'Escape':
        e.preventDefault()
        onCancel()
        break
    }
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <span className="font-mono text-sm font-bold text-primary">&gt;</span>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          setSelectedIndex(0)
        }}
        onKeyDown={handleKeyDown}
        onBlur={commitOrCancel}
        autoFocus
        className="min-w-0 flex-1 border-0 bg-transparent font-mono text-sm outline-none"
        aria-label="Edit filter query"
      />
      <AnchoredPopup
        open={hasSuggestions}
        anchor={inputRef}
        initialFocus={false}
        className="min-w-(--anchor-width)"
      >
        {suggestions?.map((suggestion, index) => (
          <button
            key={suggestion.value}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              applySuggestion(suggestion)
            }}
            className={cn(
              'flex w-full items-center gap-2 px-3 py-1.5 text-left font-mono text-xs',
              index === selectedIndex
                ? 'bg-accent text-accent-foreground'
                : 'text-popover-foreground hover:bg-accent/50',
            )}
          >
            <span>{suggestion.value}</span>
            <span className="text-muted-foreground">{suggestion.display}</span>
          </button>
        ))}
      </AnchoredPopup>
    </div>
  )
}
