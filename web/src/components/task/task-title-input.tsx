import { useMemo, useRef, useState } from 'react'

import { TaskMentionSummary } from '#components/task/task-mention-summary'
import { AnchoredPopup } from '#components/ui/anchored-popup'
import { Input } from '#components/ui/input'
import { useCurrentContext } from '#hooks/use-current-context'
import { useLabels } from '#hooks/use-labels'
import {
  type MentionSuggestion,
  useTaskMentionSuggestions,
} from '#hooks/use-task-mentions'
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

  // `^` candidates come from an async server search rather than
  // getSuggestions, so they're kept in a separate list.
  const isParentTrigger = cursorTrigger?.trigger === '^'
  const { data: parentSuggestionsData } = useTaskMentionSuggestions(
    isParentTrigger ? cursorTrigger.partial : '',
    isParentTrigger,
  )
  const parentSuggestions = isParentTrigger ? (parentSuggestionsData ?? []) : []

  const suggestions = useMemo(() => {
    if (!cursorTrigger || isParentTrigger) return []
    return getSuggestions(
      cursorTrigger.trigger,
      cursorTrigger.partial,
      availableLabels,
    )
  }, [cursorTrigger, isParentTrigger, availableLabels])

  const suggestionCount = isParentTrigger
    ? parentSuggestions.length
    : suggestions.length

  const updateTrigger = (nextValue: string, cursorPos: number) => {
    setCursorTrigger(detectTrigger(nextValue, cursorPos))
    setSelectedIndex(0)
  }

  // Completed shorthand tokens require trailing whitespace to be recognized.
  const applyToken = (tokenValue: string) => {
    if (!cursorTrigger) return
    const before = value.slice(0, cursorTrigger.tokenStart)
    const tokenEnd = value.indexOf(' ', cursorTrigger.tokenStart)
    const after = value.slice(tokenEnd === -1 ? value.length : tokenEnd)
    onChange(
      `${before}${cursorTrigger.trigger}${tokenValue}${after ? '' : ' '}${after}`,
    )
    setCursorTrigger(null)
  }

  const applySuggestion = (item: SuggestionItem) => {
    applyToken(item.value)
  }

  const applyParentSuggestion = (item: MentionSuggestion) => {
    applyToken(String(item.number))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return
    if (!cursorTrigger || suggestionCount === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % suggestionCount)
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(
          (prev) => (prev - 1 + suggestionCount) % suggestionCount,
        )
        break
      case 'Enter':
      case 'Tab': {
        e.preventDefault()
        if (isParentTrigger) {
          const candidate = parentSuggestions[selectedIndex]
          if (candidate != null) applyParentSuggestion(candidate)
        } else {
          const suggestion = suggestions[selectedIndex]
          if (suggestion != null) applySuggestion(suggestion)
        }
        break
      }
      case 'Escape':
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
        open={suggestionCount > 0}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setCursorTrigger(null)
        }}
        anchor={inputRef}
        initialFocus={false}
        className={isParentTrigger ? 'w-64' : 'w-40 font-mono'}
      >
        {isParentTrigger
          ? parentSuggestions.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs',
                  index === selectedIndex
                    ? 'bg-accent text-accent-foreground'
                    : 'text-popover-foreground hover:bg-accent/50',
                )}
                onMouseDown={(e) => {
                  e.preventDefault()
                  applyParentSuggestion(item)
                }}
              >
                <TaskMentionSummary
                  status={item.status}
                  number={item.number}
                  title={item.title}
                />
              </button>
            ))
          : suggestions.map((item, index) => (
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
