import { parseSearchQuery } from 'api/search-query-parser'
import { useEffect, useRef, useState } from 'react'

import { AnchoredPopup } from '#components/ui/anchored-popup'
import type { Suggestion } from '#hooks/use-search'
import {
  applySuggestionToQuery,
  extractCurrentPrefix,
  useSearchSuggestions,
} from '#hooks/use-search'
import { cn } from '#lib/utils'

interface TaskFilterFreeTextInputProps {
  id: string
  freeText: string
  onCommit: (freeText: string) => void
  onBackspaceEmpty: () => void
  placeholder?: string
}

// The tail of the filter row's token input: a plain text box for the parts
// of the query that aren't a structured `key:value` condition. Always
// mounted (no edit-mode toggle) so it stays visible across viewports.
// Typing a recognized token (e.g. `is:todo`) and committing hands it to the
// caller, which lifts it out into a chip; anything left over round-trips
// back here as plain freeText.
export function TaskFilterFreeTextInput({
  id,
  freeText,
  onCommit,
  onBackspaceEmpty,
  placeholder,
}: TaskFilterFreeTextInputProps) {
  const [value, setValue] = useState(freeText)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Resync when freeText changes for a reason other than our own commit
  // below (e.g. a chip removed elsewhere in the row), but never while the
  // user has this field focused with unsent edits.
  useEffect(() => {
    if (document.activeElement === inputRef.current) return
    setValue(freeText)
  }, [freeText])

  const currentPrefix = extractCurrentPrefix(value)
  const { data: suggestions } = useSearchSuggestions(currentPrefix)
  const hasSuggestions =
    suggestions != null && suggestions.length > 0 && currentPrefix.length > 0

  const applySuggestion = (suggestion: Suggestion) => {
    setValue(applySuggestionToQuery(value, suggestion))
    setSelectedIndex(0)
  }

  const commit = () => {
    const trimmed = value.trim()
    if (trimmed === freeText.trim()) return
    onCommit(trimmed)
    // Reflect the leftover text immediately rather than waiting for the
    // caller's merged `freeText` to round-trip back down as a prop — that
    // round trip can leave `value` unchanged (e.g. committing an
    // already-applied `is:todo` again) or never resync while this input
    // stays focused, either of which would strand the just-lifted token
    // visibly in the box even though it already became a chip.
    setValue(parseSearchQuery(trimmed).freeText)
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
          commit()
        }
        break
      }
      case 'Escape':
        e.preventDefault()
        setValue(freeText)
        break
      case 'Backspace':
        if (value === '') {
          onBackspaceEmpty()
        }
        break
    }
  }

  return (
    <div className="flex min-w-32 flex-1 items-center">
      <input
        id={id}
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          setSelectedIndex(0)
        }}
        onKeyDown={handleKeyDown}
        onBlur={commit}
        placeholder={placeholder}
        className="min-w-0 flex-1 border-0 bg-transparent font-mono text-sm outline-none placeholder:text-muted-foreground"
        aria-label="Filter query"
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
