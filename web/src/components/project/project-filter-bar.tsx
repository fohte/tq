import { selectHandler } from '@web/lib/form-utils'
import { cn } from '@web/lib/utils'
import { Plus } from 'lucide-react'

export type StatusFilter = 'all' | 'todo' | 'in_progress' | 'completed'

export type SortOption = 'manual' | 'due' | 'created' | 'updated'

const statusFilters = [
  { value: 'all', label: 'All' },
  { value: 'todo', label: 'Todo' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
] as const satisfies ReadonlyArray<{ value: StatusFilter; label: string }>

const sortOptionValues = [
  'manual',
  'due',
  'created',
  'updated',
] as const satisfies readonly SortOption[]

const sortLabels: Record<SortOption, string> = {
  manual: 'Manual',
  due: 'Due Date',
  created: 'Created',
  updated: 'Updated',
}

export function ProjectFilterBar({
  statusFilter,
  onStatusFilterChange,
  sortOption,
  onSortOptionChange,
  onAddTask,
}: {
  statusFilter: StatusFilter
  onStatusFilterChange: (filter: StatusFilter) => void
  sortOption: SortOption
  onSortOptionChange: (sort: SortOption) => void
  onAddTask?: () => void
}) {
  return (
    <div className="flex items-center gap-2 border-b border-border px-4 py-2">
      {/* Filter chips */}
      <div className="flex items-center gap-1">
        {statusFilters.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              onStatusFilterChange(value)
            }}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              statusFilter === value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Sort selector */}
        <select
          value={sortOption}
          onChange={selectHandler(onSortOptionChange, sortOptionValues)}
          className="rounded-md bg-transparent px-2 py-1 text-xs text-muted-foreground outline-none hover:text-foreground"
        >
          {sortOptionValues.map((sort) => (
            <option key={sort} value={sort}>
              Sort: {sortLabels[sort]}
            </option>
          ))}
        </select>

        {/* Add task button */}
        {onAddTask && (
          <button
            type="button"
            onClick={onAddTask}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Add task"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}
