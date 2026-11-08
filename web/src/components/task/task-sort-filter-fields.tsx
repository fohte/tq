import { OrderedToggleGroup } from '#components/ui/ordered-toggle-group'
import type { TaskSortBy } from '#hooks/use-tasks'
import { sortLabels, sortOptionValues } from '#lib/tasks-query'

export function TaskSortFilterFields({
  sortBy,
  onSortByChange,
}: {
  sortBy: TaskSortBy[]
  onSortByChange: (sortBy: TaskSortBy[]) => void
}) {
  return (
    <OrderedToggleGroup
      values={sortBy}
      options={sortOptionValues.map((sort) => ({
        value: sort,
        label: sortLabels[sort],
      }))}
      onValuesChange={onSortByChange}
    />
  )
}
