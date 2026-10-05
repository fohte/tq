import { SegmentedControl } from '@fohte/ui/segmented-control'

import type { TaskSortBy } from '#hooks/use-tasks'
import { sortLabels, sortOptionValues } from '#lib/tasks-query'

export function TaskSortFilterFields({
  sortBy,
  onSortByChange,
}: {
  sortBy: TaskSortBy
  onSortByChange: (sortBy: TaskSortBy) => void
}) {
  return (
    <SegmentedControl
      value={sortBy}
      options={sortOptionValues.map((sort) => ({
        value: sort,
        label: sortLabels[sort] ?? sort,
      }))}
      onValueChange={onSortByChange}
    />
  )
}
