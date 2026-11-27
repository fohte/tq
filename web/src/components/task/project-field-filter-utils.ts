import type { ParsedQuery } from 'api/search-query-parser'

import type { ProjectField } from '#hooks/use-project-fields'

export function getProjectFieldFilterNames(
  projectFields: ProjectField[],
  fields: ParsedQuery['fields'],
) {
  return [
    ...projectFields.map((field) => field.name),
    ...Object.keys(fields ?? {}).filter(
      (name) => !projectFields.some((field) => field.name === name),
    ),
  ]
}

export function getProjectFieldOptionLabel(name: string) {
  return name === 'Any' || name === 'Unset' || name.startsWith('Option: ')
    ? `Option: ${name}`
    : name
}
