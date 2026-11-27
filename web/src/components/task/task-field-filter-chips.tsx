import { List, ListItem } from '@fohte/ui/list'
import type { ParsedQuery } from 'api/search-query-parser'

import {
  getProjectFieldFilterNames,
  getProjectFieldOptionLabel,
} from '#components/task/project-field-filter-utils'
import { TaskFilterChip } from '#components/task/task-filter-chip'
import { taskFilterAxisIcons } from '#components/task/task-filter-icons'
import type { ProjectField } from '#hooks/use-project-fields'
import { withField } from '#lib/tasks-query'

export function TaskFieldFilterChips({
  projectFields,
  parsed,
  onChange,
  defaultOpen = false,
}: {
  projectFields: ProjectField[]
  parsed: ParsedQuery
  onChange: (parsed: ParsedQuery) => void
  defaultOpen?: boolean
}) {
  const names = getProjectFieldFilterNames(projectFields, parsed.fields)

  return (
    <>
      {names.map((name) => {
        const field = projectFields.find((candidate) => candidate.name === name)
        const hasFilter = Object.hasOwn(parsed.fields ?? {}, name)
        const selectedValue = parsed.fields?.[name]
        const value = !hasFilter
          ? 'Any'
          : selectedValue == null
            ? 'Unset'
            : getProjectFieldOptionLabel(selectedValue)

        return (
          <TaskFilterChip
            key={name}
            icon={taskFilterAxisIcons.field}
            attribute={name}
            value={value}
            menuTitle={name}
            ariaLabel={`${name} ${value}`}
            defaultOpen={defaultOpen}
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
                  {getProjectFieldOptionLabel(option.name)}
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
