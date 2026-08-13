import { Link } from '@tanstack/react-router'
import { Loader2, X } from 'lucide-react'
import { useRef, useState } from 'react'

import {
  SearchResultRow,
  searchResultRowWrapperClassName,
} from '#components/search/search-result-row'
import { AnchoredPopup } from '#components/ui/anchored-popup'
import { Chip } from '#components/ui/chip'
import { ScreenHeaderBar } from '#components/ui/screen-header-bar'
import type { SearchFilters, SearchResult } from '#hooks/use-search'
import { useSearch } from '#hooks/use-search'
import { cn } from '#lib/utils'

interface FilterChipProps {
  label: string
  value: string | undefined
  options: Array<{ value: string; label: string }>
  onChange: (value: string | undefined) => void
}

function FilterChip({ label, value, options, onChange }: FilterChipProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const activeLabel =
    value != null
      ? (options.find((o) => o.value === value)?.label ?? value)
      : label

  return (
    <div ref={ref}>
      <Chip
        as="button"
        size="md"
        active={value != null}
        onClick={() => {
          setOpen(!open)
        }}
        data-testid={`filter-chip-${label.toLowerCase()}`}
      >
        {activeLabel}
        <span className="text-muted-foreground-faint">▾</span>
      </Chip>

      <AnchoredPopup
        open={open}
        onOpenChange={setOpen}
        anchor={ref}
        className="w-auto min-w-35"
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
              'flex w-full items-center px-3 py-1.5 text-left font-mono text-xs',
              value === option.value
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:bg-secondary/50',
            )}
          >
            {option.label}
          </button>
        ))}
      </AnchoredPopup>
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
]

const SORT_OPTIONS = [
  { value: 'due', label: 'Due date' },
  { value: 'created', label: 'Created' },
  { value: 'updated', label: 'Updated' },
  { value: 'estimate', label: 'Estimate' },
]

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
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          onBack?.()
        }
      }}
    >
      <ScreenHeaderBar>
        <span className="font-mono text-sm font-bold text-primary">&gt;</span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
          }}
          placeholder="search tasks…"
          className="flex-1 border-0 bg-transparent font-mono text-sm outline-none placeholder:text-muted-foreground"
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
        {onBack != null && (
          <button
            type="button"
            onClick={onBack}
            className="font-mono text-2xs text-muted-foreground-ghost hover:text-muted-foreground"
          >
            esc to close
          </button>
        )}
      </ScreenHeaderBar>

      {/* Filter row */}
      <div
        className="flex items-center gap-2 border-b border-border px-3 py-2"
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
        <span className="ml-auto font-mono text-2xs text-muted-foreground-faint">
          {results.length} results
        </span>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto" data-testid="search-results">
        {isFetching && !hasQuery ? null : isFetching && results.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : hasQuery && results.length === 0 ? (
          <div className="py-8 text-center font-mono text-xs text-muted-foreground-faint">
            {`no results for "${query}"`}
          </div>
        ) : !hasQuery ? (
          <div className="py-8 text-center font-mono text-xs text-muted-foreground-faint">
            Type to search tasks
          </div>
        ) : (
          results.map((task) => (
            <Link
              key={task.id}
              to="/tasks/$taskId"
              params={{ taskId: task.id }}
              className={searchResultRowWrapperClassName(task.status)}
              data-testid="search-result-row"
            >
              <SearchResultRow task={task} />
            </Link>
          ))
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
