import { Plus, X } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'

import { Button } from '#components/ui/button'
import { Input } from '#components/ui/input'
import { useLabels } from '#hooks/use-labels'
import { useCreateTask } from '#hooks/use-tasks'
import { formatMinutes } from '#lib/format'
import {
  detectTrigger,
  getSuggestions,
  parseTaskInput,
  type SuggestionItem,
  type TriggerChar,
} from '#lib/task-input-parser'
import { cn } from '#lib/utils'

export function CreateTaskInline({
  onClose,
  defaultStartDate,
}: {
  onClose: () => void
  defaultStartDate?: string
}) {
  const [input, setInput] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [cursorTrigger, setCursorTrigger] = useState<{
    trigger: TriggerChar
    partial: string
    tokenStart: number
  } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  const createTask = useCreateTask()
  const { data: labelsData } = useLabels()

  const availableLabels = useMemo(
    () => (labelsData ?? []).map((l) => l.name),
    [labelsData],
  )

  const parsed = useMemo(() => parseTaskInput(input), [input])

  const suggestions = useMemo(() => {
    if (!cursorTrigger) return []
    return getSuggestions(
      cursorTrigger.trigger,
      cursorTrigger.partial,
      availableLabels,
    )
  }, [cursorTrigger, availableLabels])

  const updateTrigger = useCallback(
    (value: string, cursorPos: number) => {
      const info = detectTrigger(value, cursorPos)
      setCursorTrigger(info)
      if (info) {
        const items = getSuggestions(
          info.trigger,
          info.partial,
          availableLabels,
        )
        setShowSuggestions(items.length > 0)
        setSelectedIndex(0)
      } else {
        setShowSuggestions(false)
      }
    },
    [availableLabels],
  )

  const applySuggestion = useCallback(
    (item: SuggestionItem) => {
      if (!cursorTrigger) return

      const before = input.slice(0, cursorTrigger.tokenStart)
      const tokenEnd = input.indexOf(' ', cursorTrigger.tokenStart)
      const after = input.slice(tokenEnd === -1 ? input.length : tokenEnd)

      const trigger = cursorTrigger.trigger
      const newInput = `${before}${trigger}${item.value}${after ? '' : ' '}${after}`
      setInput(newInput)
      setShowSuggestions(false)
      setCursorTrigger(null)

      requestAnimationFrame(() => {
        const el = inputRef.current
        if (el) {
          el.focus()
          const pos = before.length + 1 + item.value.length + (after ? 0 : 1)
          el.setSelectionRange(pos, pos)
        }
      })
    },
    [input, cursorTrigger],
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return

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
      case 'Tab':
        e.preventDefault()
        {
          const suggestion = suggestions[selectedIndex]
          if (suggestion != null) applySuggestion(suggestion)
        }
        break
      case 'Escape':
        e.preventDefault()
        setShowSuggestions(false)
        break
    }
  }

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault()
    if (showSuggestions) return

    if (!parsed.title.trim() || createTask.isPending) return

    const startDate = parsed.startDate ?? defaultStartDate

    createTask.mutate(
      {
        title: parsed.title.trim(),
        ...(parsed.estimatedMinutes != null
          ? { estimatedMinutes: parsed.estimatedMinutes }
          : {}),
        ...(parsed.dueDate != null ? { dueDate: parsed.dueDate } : {}),
        ...(startDate != null ? { startDate } : {}),
        ...(parsed.context != null ? { context: parsed.context } : {}),
        ...(parsed.labels.length > 0 ? { labels: parsed.labels } : {}),
      },
      {
        onSuccess: () => {
          setInput('')
          onClose()
        },
      },
    )
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInput(value)
    updateTrigger(value, e.target.selectionStart ?? value.length)
  }

  const handleSelect = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const el = e.currentTarget
    updateTrigger(el.value, el.selectionStart ?? el.value.length)
  }

  // Preview chips for parsed fields
  const previewChips: string[] = []
  if (parsed.estimatedMinutes != null) {
    previewChips.push(formatMinutes(parsed.estimatedMinutes))
  }
  if (parsed.dueDate != null) {
    previewChips.push(`due: ${parsed.dueDate}`)
  }
  if (parsed.startDate != null) {
    previewChips.push(`start: ${parsed.startDate}`)
  }
  for (const label of parsed.labels) {
    previewChips.push(`#${label}`)
  }
  if (parsed.context != null) {
    previewChips.push(parsed.context)
  }

  return (
    <div className="relative">
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 px-3 py-2"
      >
        <div className="relative min-w-0 flex-1">
          <Input
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onSelect={handleSelect}
            onClick={handleSelect}
            placeholder="New task... (@30m @tomorrow #label %work)"
            autoFocus
            className="h-auto border-0 bg-transparent p-0 text-sm shadow-none focus-visible:border-0 focus-visible:ring-0"
          />

          {/* Suggestion dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute top-full left-0 z-50 mt-1 w-48 rounded-md border border-border bg-popover py-1 shadow-md"
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
                    applySuggestion(item)
                  }}
                >
                  {cursorTrigger?.trigger}
                  {item.display}
                </button>
              ))}
            </div>
          )}
        </div>

        <Button
          type="submit"
          size="icon-xs"
          disabled={!parsed.title.trim() || createTask.isPending}
        >
          <Plus className="h-3 w-3" />
        </Button>
        <Button type="button" variant="ghost" size="icon-xs" onClick={onClose}>
          <X className="h-3 w-3" />
        </Button>
      </form>

      {/* Preview chips */}
      {previewChips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-3 pb-2">
          {previewChips.map((chip, index) => (
            <span
              key={`${chip}-${String(index)}`}
              className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
            >
              {chip}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export function FloatingActionButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      size="icon-lg"
      onClick={onClick}
      className="fixed bottom-20 right-4 z-50 md:hidden"
    >
      <Plus />
    </Button>
  )
}
