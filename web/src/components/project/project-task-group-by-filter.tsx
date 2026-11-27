import { List, ListItem } from '@fohte/ui/list'

import { FilterMenu } from '#components/ui/filter-menu'
import type { ProjectField } from '#hooks/use-project-fields'

export function ProjectTaskGroupByFilter({
  fields,
  selectedFieldId,
  onChange,
  defaultOpen = false,
}: {
  fields: ProjectField[]
  selectedFieldId?: string | undefined
  onChange: (fieldId: string | undefined) => void
  defaultOpen?: boolean
}) {
  const selectedField = fields.find((field) => field.id === selectedFieldId)

  return (
    <FilterMenu
      triggerVariant="filter-chip"
      trigger={
        <span className="inline-flex h-7 items-center rounded-md border border-input px-2.5 font-mono text-xs text-foreground">
          {selectedField == null
            ? 'Group by'
            : `Group by: ${selectedField.name}`}
        </span>
      }
      triggerAriaLabel={
        selectedField == null ? 'Group by' : `Group by ${selectedField.name}`
      }
      title="Group by"
      defaultOpen={defaultOpen}
    >
      <List>
        <ListItem
          selected={selectedField == null}
          onSelect={() => {
            onChange(undefined)
          }}
        >
          No grouping
        </ListItem>
        {fields.map((field) => (
          <ListItem
            key={field.id}
            selected={selectedFieldId === field.id}
            onSelect={() => {
              onChange(field.id)
            }}
          >
            {field.name}
          </ListItem>
        ))}
      </List>
    </FilterMenu>
  )
}
