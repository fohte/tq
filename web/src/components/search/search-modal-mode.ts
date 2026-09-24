export const SEARCH_MODE_DEFINITIONS = {
  '#': {
    mode: 'tasks',
    label: 'Tasks',
    description: 'Search tasks by title or task number.',
  },
  '!': {
    mode: 'projects',
    label: 'Projects',
    description: 'Search projects by name.',
  },
  '/': {
    mode: 'pages',
    label: 'Pages',
    description: 'Search page, comment, and task text.',
  },
  '>': {
    mode: 'commands',
    label: 'Commands',
    description: 'Browse available commands.',
  },
} as const

type SearchModePrefix = keyof typeof SEARCH_MODE_DEFINITIONS
export type SearchMode =
  (typeof SEARCH_MODE_DEFINITIONS)[SearchModePrefix]['mode']

function isSearchModePrefix(
  prefix: string | undefined,
): prefix is SearchModePrefix {
  return (
    prefix != null &&
    Object.prototype.hasOwnProperty.call(SEARCH_MODE_DEFINITIONS, prefix)
  )
}

export function parseSearchMode(query: string) {
  const prefix = query[0]
  if (isSearchModePrefix(prefix)) {
    return {
      mode: SEARCH_MODE_DEFINITIONS[prefix].mode,
      prefix,
      text: query.slice(1).trimStart(),
    }
  }

  return { mode: undefined, prefix: undefined, text: query }
}
