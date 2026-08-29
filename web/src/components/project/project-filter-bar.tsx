import { Plus, Search } from 'lucide-react'

import { Button } from '#components/ui/button'
import { TabStrip } from '#components/ui/tab-strip'
import { selectHandler } from '#lib/form-utils'

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
  onLinkExistingTask,
}: {
  statusFilter: StatusFilter
  onStatusFilterChange: (filter: StatusFilter) => void
  sortOption: SortOption
  onSortOptionChange: (sort: SortOption) => void
  onAddTask?: () => void
  onLinkExistingTask?: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
      {/* Filter chips */}
      <TabStrip
        value={statusFilter}
        options={statusFilters}
        onChange={onStatusFilterChange}
      />

      <div className="ml-auto flex items-center gap-2">
        {/* Sort selector */}
        <select
          value={sortOption}
          onChange={selectHandler(onSortOptionChange, sortOptionValues)}
          className="bg-transparent px-2 py-1 font-mono text-xs text-muted-foreground outline-none hover:text-foreground"
        >
          {sortOptionValues.map((sort) => (
            <option key={sort} value={sort}>
              Sort: {sortLabels[sort]}
            </option>
          ))}
        </select>

        {/* Link existing task button */}
        {onLinkExistingTask && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onLinkExistingTask}
            aria-label="Link existing task"
          >
            <Search className="h-4 w-4" />
          </Button>
        )}

        {/* Add task button */}
        {onAddTask && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onAddTask}
            aria-label="Add task"
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
