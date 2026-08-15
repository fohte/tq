import { useNavigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { SearchResultRow } from '#components/search/search-result-row'
import { KeybindHint } from '#components/ui/keybind-hint'
import type { SearchResult, Suggestion } from '#hooks/use-search'
import {
  extractCurrentPrefix,
  useSearchSuggestions,
  useSearchTasks,
} from '#hooks/use-search'
import { cn } from '#lib/utils'

interface SearchModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type ListItem =
  | { type: 'suggestion'; data: Suggestion }
  | { type: 'task'; data: SearchResult }

export function SearchModal({ open, onOpenChange }: SearchModalProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const lastMousePos = useRef({ x: 0, y: 0 })
  const navigate = useNavigate()

  const { data: tasks, isFetching } = useSearchTasks(query)

  const currentPrefix = extractCurrentPrefix(query)
  const { data: suggestions } = useSearchSuggestions(currentPrefix)

  const items = useMemo((): ListItem[] => {
    const result: ListItem[] = []
    if (suggestions && currentPrefix.length > 0) {
      for (const s of suggestions) {
        result.push({ type: 'suggestion', data: s })
      }
    }
    if (tasks) {
      for (const t of tasks) {
        result.push({ type: 'task', data: t })
      }
    }
    return result
  }, [suggestions, tasks, currentPrefix])

  useEffect(() => {
    setSelectedIndex(0)
  }, [items])

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
    }
  }, [open])

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current == null) return
    const selected = listRef.current.querySelector('[data-selected="true"]')
    if (typeof selected?.scrollIntoView === 'function') {
      selected.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  const applySuggestion = useCallback(
    (suggestion: Suggestion) => {
      const parts = query.split(/\s+/)
      parts[parts.length - 1] = suggestion.value
      const newQuery = parts.join(' ') + ' '
      setQuery(newQuery)
      inputRef.current?.focus()
    },
    [query],
  )

  const openTask = useCallback(
    (task: SearchResult) => {
      onOpenChange(false)
      void navigate({ to: '/tasks/$taskId', params: { taskId: task.id } })
    },
    [navigate, onOpenChange],
  )

  const handleSelect = useCallback(
    (index: number) => {
      const item = items[index]
      if (item == null) return
      if (item.type === 'suggestion') {
        applySuggestion(item.data)
      } else {
        openTask(item.data)
      }
    },
    [items, applySuggestion, openTask],
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1))
        break
      case 'Enter':
        e.preventDefault()
        handleSelect(selectedIndex)
        break
      case 'Tab':
        e.preventDefault()
        if (items[selectedIndex]?.type === 'suggestion') {
          handleSelect(selectedIndex)
        }
        break
      case 'Escape':
        e.preventDefault()
        onOpenChange(false)
        break
    }
  }

  const hasSuggestions =
    suggestions != null && suggestions.length > 0 && currentPrefix.length > 0
  const hasTasks = query.length > 0 && tasks != null && tasks.length > 0

  if (!open) return null

  return createPortal(
    <>
      {/* Backdrop + Modal wrapper (single layer to avoid z-index stacking issues) */}
      <div
        className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 modal-top-offset"
        data-testid="search-overlay"
        onKeyDown={handleKeyDown}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onOpenChange(false)
          }
        }}
      >
        <div
          className="flex max-h-120 w-full max-w-160 flex-col overflow-hidden border border-border bg-popover text-popover-foreground"
          role="dialog"
          aria-label="Search"
        >
          {/* Search input */}
          <div className="flex h-12 items-center gap-3 border-b border-border px-4">
            <span className="font-mono text-sm font-bold text-primary">
              &gt;
            </span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
              }}
              placeholder="Search tasks..."
              autoFocus
              className="flex-1 border-0 bg-transparent font-mono text-sm outline-none placeholder:text-muted-foreground"
              aria-label="Search tasks"
            />
            {isFetching && (
              <Loader2
                className="h-4 w-4 shrink-0 animate-spin text-muted-foreground"
                data-testid="search-loading"
              />
            )}
            <KeybindHint variant="boxed">Esc</KeybindHint>
          </div>

          {/* Results list */}
          <div
            ref={listRef}
            className="flex-1 overflow-y-auto py-2"
            role="listbox"
            aria-label="Search results"
          >
            {/* Suggestions section */}
            {hasSuggestions && (
              <>
                <div className="px-4 py-1 font-mono text-2xs tracking-widest text-muted-foreground-faint">
                  Suggestions
                </div>
                {suggestions.map((suggestion, i) => {
                  const globalIndex = i
                  return (
                    <button
                      type="button"
                      key={suggestion.value}
                      role="option"
                      aria-selected={selectedIndex === globalIndex}
                      data-selected={selectedIndex === globalIndex}
                      onClick={() => {
                        applySuggestion(suggestion)
                      }}
                      onMouseMove={(e) => {
                        if (
                          e.clientX !== lastMousePos.current.x ||
                          e.clientY !== lastMousePos.current.y
                        ) {
                          lastMousePos.current = {
                            x: e.clientX,
                            y: e.clientY,
                          }
                          setSelectedIndex(globalIndex)
                        }
                      }}
                      className={cn(
                        'flex w-full items-center gap-2 px-4 py-2 text-left',
                        selectedIndex === globalIndex
                          ? 'bg-secondary'
                          : 'hover:bg-secondary/50',
                      )}
                    >
                      <span className="font-mono text-sm text-foreground">
                        {suggestion.value}
                      </span>
                      <span className="text-2xs text-muted-foreground">
                        {suggestion.display}
                      </span>
                    </button>
                  )
                })}
              </>
            )}

            {/* Divider between suggestions and tasks */}
            {hasSuggestions && hasTasks && (
              <div className="mx-4 my-1 h-px bg-border" />
            )}

            {/* Tasks section */}
            {hasTasks && (
              <>
                <div className="px-4 py-1 font-mono text-2xs tracking-widest text-muted-foreground-faint">
                  Tasks
                </div>
                {tasks.map((task, i) => {
                  const globalIndex =
                    (hasSuggestions ? suggestions.length : 0) + i
                  return (
                    <button
                      type="button"
                      key={task.id}
                      role="option"
                      aria-selected={selectedIndex === globalIndex}
                      data-selected={selectedIndex === globalIndex}
                      onClick={() => {
                        openTask(task)
                      }}
                      onMouseMove={(e) => {
                        if (
                          e.clientX !== lastMousePos.current.x ||
                          e.clientY !== lastMousePos.current.y
                        ) {
                          lastMousePos.current = {
                            x: e.clientX,
                            y: e.clientY,
                          }
                          setSelectedIndex(globalIndex)
                        }
                      }}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-3 text-left',
                        selectedIndex === globalIndex
                          ? 'bg-secondary'
                          : 'hover:bg-secondary/50',
                        task.status === 'completed' && 'dim-completed',
                      )}
                    >
                      <SearchResultRow task={task} />
                    </button>
                  )
                })}
              </>
            )}

            {/* Empty state */}
            {query.length > 0 &&
              !isFetching &&
              !hasTasks &&
              !hasSuggestions && (
                <div className="px-4 py-8 text-center font-mono text-xs text-muted-foreground-faint">
                  {`no results for "${query}"`}
                </div>
              )}

            {/* Initial state */}
            {query.length === 0 && (
              <div className="px-4 py-8 text-center font-mono text-xs text-muted-foreground-faint">
                Type to search tasks
              </div>
            )}
          </div>

          {/* Footer with keyboard hints */}
          <div className="flex h-9 items-center gap-1.5 border-t border-border px-4 font-mono text-2xs text-muted-foreground-ghost">
            <KeybindHint variant="boxed">↑↓</KeybindHint>
            <span>navigate</span>
            <KeybindHint variant="boxed">Tab</KeybindHint>
            <span>autocomplete</span>
            <KeybindHint variant="boxed">Enter</KeybindHint>
            <span>open</span>
            <KeybindHint variant="boxed">Esc</KeybindHint>
            <span>close</span>
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}
