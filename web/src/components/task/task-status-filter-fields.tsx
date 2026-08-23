import type { ParsedQuery } from 'api/search-query-parser'
import { useId } from 'react'

import { Checkbox } from '#components/ui/checkbox'

type TaskStatusValue = NonNullable<ParsedQuery['status']>[number]

const STATUS_OPTIONS: { value: TaskStatusValue; label: string }[] = [
  { value: 'todo', label: 'Todo' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
]

// Rendered both inside the applied `is` chip's own menu and inside the
// `+ filter` panel's STATUS section, so ids are scoped per instance via
// useId() to stay unique when both are mounted at once.
export function TaskStatusFilterFields({
  status,
  onStatusChange,
}: {
  status: TaskStatusValue[]
  onStatusChange: (status: TaskStatusValue[]) => void
}) {
  const idPrefix = useId()

  return (
    <div className="flex flex-col gap-1.5">
      {STATUS_OPTIONS.map((option) => {
        const id = `${idPrefix}-${option.value}`
        // Unchecking the last remaining status would leave an empty array,
        // which round-trips through buildSearchQuery/parseSearchQuery as
        // "no status filter" (match everything) rather than "match
        // nothing" — the opposite of what an all-unchecked group implies.
        // "Show everything" stays reachable by checking all three instead.
        const isLastChecked =
          status.length === 1 && status.includes(option.value)
        return (
          <div key={option.value} className="flex items-center gap-2">
            <Checkbox
              id={id}
              checked={status.includes(option.value)}
              disabled={isLastChecked}
              onCheckedChange={(checked) => {
                if (!checked && isLastChecked) return
                onStatusChange(
                  checked
                    ? [...status, option.value]
                    : status.filter((value) => value !== option.value),
                )
              }}
            />
            <label htmlFor={id} className="text-sm text-foreground">
              {option.label}
            </label>
          </div>
        )
      })}
    </div>
  )
}
