import { List, ListItem } from '@fohte/ui/list'
import type { ParsedQuery } from 'api/search-query-parser'

import { TaskFilterChip } from '#components/task/task-filter-chip'
import { taskFilterAxisIcons } from '#components/task/task-filter-icons'
import type { ProjectField } from '#hooks/use-project-fields'
import { withField } from '#lib/tasks-query'

export function TaskFieldFilterChips({
  projectFields,
  parsed,
  onChange,
}: {
  projectFields: ProjectField[]
  parsed: ParsedQuery
  onChange: (parsed: ParsedQuery) => void
}) {
  const names = [
    ...projectFields.map((field) => field.name),
    ...Object.keys(parsed.fields ?? {}).filter(
      (name) => !projectFields.some((field) => field.name === name),
    ),
  ]

  return (
    <>
      {names.map((name) => {
        const field = projectFields.find((candidate) => candidate.name === name)
        const hasFilter = Object.hasOwn(parsed.fields ?? {}, name)
        const selectedValue = parsed.fields?.[name]
        const value = !hasFilter ? 'Any' : (selectedValue ?? 'Unset')

        return (
          <TaskFilterChip
            key={name}
            icon={taskFilterAxisIcons.field}
            attribute={name}
            value={value}
            menuTitle={name}
            ariaLabel={`${name} ${value}`}
            onRemove={
              hasFilter
                ? () => {
                    onChange(withField(parsed, name, undefined))
                  }
                : undefined
            }
          >
            <List>
              <ListItem
                selected={!hasFilter}
                onSelect={() => {
                  onChange(withField(parsed, name, undefined))
                }}
              >
                Any
              </ListItem>
              {field?.options.map((option) => (
                <ListItem
                  key={option.id}
                  selected={selectedValue === option.name}
                  onSelect={() => {
                    onChange(withField(parsed, name, option.name))
                  }}
                >
                  {option.name}
                </ListItem>
              ))}
              <ListItem
                selected={hasFilter && selectedValue === null}
                onSelect={() => {
                  onChange(withField(parsed, name, null))
                }}
              >
                Unset
              </ListItem>
            </List>
          </TaskFilterChip>
        )
      })}
    </>
  )
}
