import { useMemo, useRef, useState } from 'react'

import { AnchoredPopup } from '#components/ui/anchored-popup'
import { Input } from '#components/ui/input'
import { useCurrentContext } from '#hooks/use-current-context'
import { useLabels } from '#hooks/use-labels'
import {
  detectTrigger,
  getSuggestions,
  type SuggestionItem,
  type TriggerChar,
} from '#lib/task-shorthand'
import { cn } from '#lib/utils'

export function TaskTitleInput({
  value,
  onChange,
  placeholder,
  autoFocus,
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  autoFocus?: boolean
  className?: string
}) {
  const context = useCurrentContext()
  const { data: labelsData } = useLabels({ context })
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [cursorTrigger, setCursorTrigger] = useState<{
    trigger: TriggerChar
    partial: string
    tokenStart: number
  } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const availableLabels = useMemo(
    () => (labelsData ?? []).map((l) => l.name),
    [labelsData],
  )

  const suggestions = useMemo(() => {
    if (!cursorTrigger) return []
    return getSuggestions(
      cursorTrigger.trigger,
      cursorTrigger.partial,
      availableLabels,
    )
  }, [cursorTrigger, availableLabels])

  const updateTrigger = (nextValue: string, cursorPos: number) => {
    setCursorTrigger(detectTrigger(nextValue, cursorPos))
    setSelectedIndex(0)
  }

  // Replaces the trigger token (up to the next space) with the selected
  // suggestion. The token change reaching `onChange` with a trailing space
  // is what makes the existing shorthand-extraction path pick it up.
  const applySuggestion = (item: SuggestionItem) => {
    if (!cursorTrigger) return
    const before = value.slice(0, cursorTrigger.tokenStart)
    const tokenEnd = value.indexOf(' ', cursorTrigger.tokenStart)
    const after = value.slice(tokenEnd === -1 ? value.length : tokenEnd)
    onChange(
      `${before}${cursorTrigger.trigger}${item.value}${after ? '' : ' '}${after}`,
    )
    setCursorTrigger(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return
    if (!cursorTrigger || suggestions.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % suggestions.length)
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(
          (prev) => (prev - 1 + suggestions.length) % suggestions.length,
        )
        break
      case 'Enter':
      case 'Tab': {
        e.preventDefault()
        const suggestion = suggestions[selectedIndex]
        if (suggestion != null) applySuggestion(suggestion)
        break
      }
      case 'Escape':
        // Stop propagation so the enclosing modal doesn't close along with
        // the suggestion menu.
        e.preventDefault()
        e.stopPropagation()
        setCursorTrigger(null)
        break
    }
  }

  return (
    <>
      <Input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          updateTrigger(
            e.target.value,
            e.target.selectionStart ?? e.target.value.length,
          )
        }}
        onKeyDown={handleKeyDown}
        onSelect={(e) => {
          updateTrigger(
            e.currentTarget.value,
            e.currentTarget.selectionStart ?? e.currentTarget.value.length,
          )
        }}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={className}
      />
      <AnchoredPopup
        open={suggestions.length > 0}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setCursorTrigger(null)
        }}
        anchor={inputRef}
        initialFocus={false}
        className="w-40 font-mono"
      >
        {suggestions.map((item, index) => (
          <button
            key={item.value}
            type="button"
            className={cn(
              'w-full px-3 py-1.5 text-left text-xs',
              index === selectedIndex
                ? 'bg-accent text-accent-foreground'
                : 'text-popover-foreground hover:bg-accent/50',
            )}
            onMouseDown={(e) => {
              e.preventDefault()
              applySuggestion(item)
            }}
          >
            {cursorTrigger?.trigger}
            {item.display}
          </button>
        ))}
      </AnchoredPopup>
    </>
  )
}
