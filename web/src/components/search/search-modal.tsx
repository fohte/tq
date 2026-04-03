import { useNavigate } from '@tanstack/react-router'
import type { SearchResult, Suggestion } from '@web/hooks/use-search'
import { useSearchSuggestions, useSearchTasks } from '@web/hooks/use-search'
import { formatMinutes } from '@web/lib/format'
import { cn } from '@web/lib/utils'
import {
  CircleCheckBig,
  CircleDot,
  Loader2,
  Search,
  Square,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface SearchModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type ListItem =
  | { type: 'suggestion'; data: Suggestion }
  | { type: 'task'; data: SearchResult }

function StatusIcon({ status }: { status: SearchResult['status'] }) {
  if (status === 'completed') {
    return (
      <CircleCheckBig className="h-[18px] w-[18px] shrink-0 text-muted-foreground" />
    )
  }
  if (status === 'in_progress') {
    return <CircleDot className="h-[18px] w-[18px] shrink-0 text-primary" />
  }
  return <Square className="h-[18px] w-[18px] shrink-0 text-muted-foreground" />
}

function ContextBadge({ context }: { context: SearchResult['context'] }) {
  if (context === 'personal') return null

  return (
    <span
      className={cn(
        'rounded-[10px] px-2 py-0.5 text-[11px] font-medium',
        context === 'work' && 'bg-[#3D2020] text-[#FF5C33]',
        context === 'dev' && 'bg-[#1A2040] text-[#B2B2FF]',
      )}
    >
      {context}
    </span>
  )
}

function extractCurrentPrefix(query: string): string {
  const parts = query.split(/\s+/)
  const last = parts[parts.length - 1] ?? ''
  if (last.includes(':') && !last.endsWith(':')) return ''
  return last
}

export function SearchModal({ open, onOpenChange }: SearchModalProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
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
  }, [items.length])

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
  const hasTasks = tasks != null && tasks.length > 0

  if (!open) return null

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50"
        data-testid="search-overlay"
        onClick={() => {
          onOpenChange(false)
        }}
      />

      {/* Modal */}
      <div
        className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
        onKeyDown={handleKeyDown}
        data-testid="search-modal"
      >
        <div
          className="flex max-h-[480px] w-full max-w-[640px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
          role="dialog"
          aria-label="Search"
        >
          {/* Search input */}
          <div className="flex h-12 items-center gap-3 border-b border-border px-4">
            <Search className="h-[18px] w-[18px] shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
              }}
              placeholder="Search tasks..."
              autoFocus
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              aria-label="Search tasks"
            />
            {isFetching && (
              <Loader2
                className="h-4 w-4 shrink-0 animate-spin text-muted-foreground"
                data-testid="search-loading"
              />
            )}
            <kbd className="flex shrink-0 items-center rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
              Esc
            </kbd>
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
                <div className="px-4 py-1 text-[11px] font-medium text-muted-foreground">
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
                      onMouseEnter={() => {
                        setSelectedIndex(globalIndex)
                      }}
                      className={cn(
                        'flex w-full items-center gap-2 px-4 py-2 text-left',
                        selectedIndex === globalIndex
                          ? 'bg-secondary'
                          : 'hover:bg-secondary/50',
                      )}
                    >
                      <span className="font-mono text-[13px] text-foreground">
                        {suggestion.value}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
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
                <div className="px-4 py-1 text-[11px] font-medium text-muted-foreground">
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
                      onMouseEnter={() => {
                        setSelectedIndex(globalIndex)
                      }}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-3 text-left',
                        selectedIndex === globalIndex
                          ? 'bg-secondary'
                          : 'hover:bg-secondary/50',
                        task.status === 'completed' && 'opacity-50',
                      )}
                    >
                      <StatusIcon status={task.status} />
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-sm font-medium text-foreground">
                          {task.title}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <ContextBadge context={task.context} />
                          {task.estimatedMinutes != null && (
                            <span className="font-mono text-xs text-muted-foreground">
                              {formatMinutes(task.estimatedMinutes)}
                            </span>
                          )}
                        </div>
                      </div>
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
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No results found
                </div>
              )}

            {/* Initial state */}
            {query.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                Type to search tasks...
              </div>
            )}
          </div>

          {/* Footer with keyboard hints */}
          <div className="flex h-9 items-center border-t border-border px-4">
            <span className="font-mono text-[11px] text-muted-foreground">
              <kbd>↑↓</kbd> navigate <kbd>Tab</kbd> autocomplete{' '}
              <kbd>Enter</kbd> open <kbd>Esc</kbd> close
            </span>
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}
