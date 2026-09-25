import { TaskFilterChipRow } from '#components/task/task-filter-chip-row'
import type { Project } from '#hooks/use-projects'
import { parseKanbanFilterQuery } from '#lib/kanban-filter-query'

interface KanbanFilterRowProps {
  query: string
  onQueryChange: (query: string) => void
  projects: Project[]
  defaultOpenSearchHelp?: boolean
}

export function KanbanFilterRow({
  query,
  onQueryChange,
  projects,
  defaultOpenSearchHelp,
}: KanbanFilterRowProps) {
  return (
    <TaskFilterChipRow
      onQueryChange={onQueryChange}
      parsed={parseKanbanFilterQuery(query)}
      projects={projects}
      disableStatusFilter
      disableSortFilter
      hideSaveView
      {...(defaultOpenSearchHelp === true ? { defaultOpenSearchHelp } : {})}
    />
  )
}
