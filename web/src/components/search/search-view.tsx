import { Link } from '@tanstack/react-router'
import type { SearchFilters, SearchResult } from '@web/hooks/use-search'
import { useSearch } from '@web/hooks/use-search'
import { formatMinutes } from '@web/lib/format'
import { cn } from '@web/lib/utils'
import {
  ArrowLeft,
  ChevronDown,
  CircleCheckBig,
  CircleDot,
  Loader2,
  Search,
  Square,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

function StatusIcon({ status }: { status: string }) {
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

function ContextBadge({ context }: { context: string }) {
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

interface FilterChipProps {
  label: string
  value: string | undefined
  options: Array<{ value: string; label: string }>
  onChange: (value: string | undefined) => void
}

function FilterChip({ label, value, options, onChange }: FilterChipProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (event: MouseEvent) => {
      if (
        ref.current &&
        event.target instanceof Node &&
        !ref.current.contains(event.target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => {
          setOpen(!open)
        }}
        className={cn(
          'flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
          value != null
            ? 'bg-primary/10 text-primary'
            : 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        )}
        data-testid={`filter-chip-${label.toLowerCase()}`}
      >
        {value != null
          ? (options.find((o) => o.value === value)?.label ?? value)
          : label}
        {value != null ? (
          <X
            className="h-3 w-3"
            onClick={(e) => {
              e.stopPropagation()
              onChange(undefined)
              setOpen(false)
            }}
          />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
      </button>

      {open && (
        <div
          className="absolute top-full left-0 z-50 mt-1 min-w-[140px] rounded-lg border border-border bg-card p-1 shadow-lg"
          data-testid={`filter-dropdown-${label.toLowerCase()}`}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(value === option.value ? undefined : option.value)
                setOpen(false)
              }}
              className={cn(
                'flex w-full items-center rounded-md px-3 py-1.5 text-left text-xs transition-colors',
                value === option.value
                  ? 'bg-primary/10 text-primary'
                  : 'text-foreground hover:bg-secondary',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const STATUS_OPTIONS = [
  { value: 'todo', label: 'Todo' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
]

const CONTEXT_OPTIONS = [
  { value: 'work', label: 'Work' },
  { value: 'personal', label: 'Personal' },
  { value: 'dev', label: 'Dev' },
]

const SORT_OPTIONS = [
  { value: 'due', label: 'Due date' },
  { value: 'created', label: 'Created' },
  { value: 'updated', label: 'Updated' },
  { value: 'estimate', label: 'Estimate' },
]

function SearchResultRow({ task }: { task: SearchResult }) {
  const isCompleted = task.status === 'completed'

  return (
    <Link
      to="/tasks/$taskId"
      params={{ taskId: task.id }}
      className={cn(
        'flex items-center gap-2 border-b border-border px-3 py-2 transition-colors hover:bg-secondary/30',
        isCompleted && 'opacity-50',
      )}
      data-testid="search-result-row"
    >
      <StatusIcon status={task.status} />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={cn(
            'truncate text-sm font-medium',
            isCompleted && 'text-muted-foreground',
          )}
        >
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
    </Link>
  )
}

export interface SearchViewInnerProps {
  query: string
  setQuery: (query: string) => void
  filters: SearchFilters
  results: SearchResult[]
  isFetching: boolean
  hasQuery: boolean
  updateFilter: (key: keyof SearchFilters, value: string | undefined) => void
  onBack?: (() => void) | undefined
}

export function SearchViewInner({
  query,
  setQuery,
  filters,
  results,
  isFetching,
  hasQuery,
  updateFilter,
  onBack,
}: SearchViewInnerProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFilterChange = (
    key: keyof SearchFilters,
    value: string | undefined,
  ) => {
    updateFilter(key, value)
  }

  return (
    <div
      className="flex h-full flex-col bg-background"
      data-testid="search-view"
    >
      {/* Search header */}
      <div className="flex items-center gap-2 px-3 py-2">
        {onBack != null && (
          <button
            type="button"
            onClick={onBack}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}

        <div className="flex flex-1 items-center gap-2 rounded-lg bg-card px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
            }}
            placeholder="Search tasks..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            data-testid="search-input"
            autoFocus
          />
          {query !== '' && (
            <button
              type="button"
              onClick={() => {
                setQuery('')
              }}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {onBack != null && (
          <button
            type="button"
            onClick={onBack}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Filter row */}
      <div
        className="flex items-center gap-2 px-3 py-2"
        data-testid="filter-row"
      >
        <FilterChip
          label="Status"
          value={filters.status}
          options={STATUS_OPTIONS}
          onChange={(v) => {
            handleFilterChange('status', v)
          }}
        />
        <FilterChip
          label="Context"
          value={filters.context}
          options={CONTEXT_OPTIONS}
          onChange={(v) => {
            handleFilterChange('context', v)
          }}
        />
        <FilterChip
          label="Sort"
          value={filters.sortBy}
          options={SORT_OPTIONS}
          onChange={(v) => {
            handleFilterChange('sortBy', v)
          }}
        />
      </div>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Results */}
      <div className="flex-1 overflow-y-auto" data-testid="search-results">
        {isFetching && !hasQuery ? null : isFetching && results.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : hasQuery && results.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No results found
          </div>
        ) : !hasQuery ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Type to search tasks
          </div>
        ) : (
          results.map((task) => <SearchResultRow key={task.id} task={task} />)
        )}
      </div>
    </div>
  )
}

export interface SearchViewProps {
  onBack?: (() => void) | undefined
}

export function SearchView({ onBack }: SearchViewProps) {
  const {
    query,
    setQuery,
    filters,
    results,
    isFetching,
    hasQuery,
    updateFilter,
  } = useSearch()

  return (
    <SearchViewInner
      query={query}
      setQuery={setQuery}
      filters={filters}
      results={results}
      isFetching={isFetching}
      hasQuery={hasQuery}
      updateFilter={updateFilter}
      onBack={onBack}
    />
  )
}
