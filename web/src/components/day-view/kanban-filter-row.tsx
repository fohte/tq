import { TaskFilterChipRow } from '#components/task/task-filter-chip-row'
import { parseKanbanFilterQuery } from '#lib/kanban-filter-query'

interface KanbanFilterRowProps {
  query: string
  onQueryChange: (query: string) => void
  defaultOpenSearchHelp?: boolean
}

export function KanbanFilterRow({
  query,
  onQueryChange,
  defaultOpenSearchHelp,
}: KanbanFilterRowProps) {
  return (
    <TaskFilterChipRow
      onQueryChange={onQueryChange}
      parsed={parseKanbanFilterQuery(query)}
      disableStatusFilter
      disableSortFilter
      hideSaveView
      {...(defaultOpenSearchHelp === true ? { defaultOpenSearchHelp } : {})}
    />
  )
}
