import { type TaskStatusReason, taskStatusReason } from '#schemas/task'

export interface ParsedQuery {
  freeText: string
  status?: Array<'todo' | 'completed'>
  reason?: TaskStatusReason
  label?: string
  context?: 'work' | 'personal'
  commitment?: 'inbox' | 'active' | 'someday'
  hasPages?: boolean
  hasComments?: boolean
  hasNoChildren?: boolean
  hasBlockers?: boolean
  hasNoBlockers?: boolean
  parentId?: string
  projectId?: string
  sortBy?: 'due' | 'created' | 'updated' | 'estimate'
}

type SearchQueryTokenValue = {
  value: string
  display: string
  parse: (result: ParsedQuery) => void
}

type SearchQueryTokenDefinition =
  | {
      description: string
      taskFilter?: boolean
      values: readonly SearchQueryTokenValue[]
    }
  | {
      display: string
      description: string
      taskFilter?: boolean
      valuePlaceholder: string
      parse: (result: ParsedQuery, value: string) => void
    }

function defineFixedToken<
  const Values extends readonly (readonly [string, string])[],
>(
  values: Values,
  description: string,
  parse: (result: ParsedQuery, value: Values[number][0]) => void,
  taskFilter = false,
) {
  return {
    description,
    ...(taskFilter ? { taskFilter } : {}),
    values: values.map(([value, display]) => ({
      value,
      display,
      parse: (result: ParsedQuery) => {
        parse(result, value)
      },
    })),
  }
}

const searchQueryTokenDefinitions = new Map(
  Object.entries({
    is: defineFixedToken(
      [
        ['todo', 'Todo'],
        ['completed', 'Completed'],
      ],
      'Filter by whether a task is todo or completed.',
      (result, value) => {
        result.status = [...(result.status ?? []), value]
      },
      true,
    ),
    context: defineFixedToken(
      [
        ['work', 'Work'],
        ['personal', 'Personal'],
      ],
      'Limit results to work or personal tasks.',
      (result, value) => {
        result.context = value
      },
      true,
    ),
    commitment: defineFixedToken(
      [
        ['inbox', 'Inbox'],
        ['active', 'Active'],
        ['someday', 'Someday'],
      ],
      'Limit tasks by commitment level.',
      (result, value) => {
        result.commitment = value
      },
    ),
    sort: defineFixedToken(
      [
        ['due', 'Sort by due date'],
        ['created', 'Sort by creation date'],
        ['updated', 'Sort by update date'],
        ['estimate', 'Sort by estimate'],
      ],
      'Sort results by date or estimate.',
      (result, value) => {
        result.sortBy = value
      },
      true,
    ),
    has: defineFixedToken(
      [
        ['pages', 'Has pages'],
        ['comments', 'Has comments'],
        ['no-children', 'Has no children'],
        ['blockers', 'Has blockers'],
        ['no-blockers', 'Has no blockers'],
      ],
      'Filter by pages, comments, children, or blockers.',
      (result, value) => {
        switch (value) {
          case 'pages':
            result.hasPages = true
            break
          case 'comments':
            result.hasComments = true
            break
          case 'no-children':
            result.hasNoChildren = true
            break
          case 'blockers':
            result.hasBlockers = true
            delete result.hasNoBlockers
            break
          case 'no-blockers':
            result.hasNoBlockers = true
            delete result.hasBlockers
            break
          default: {
            const unhandledValue: never = value
            return unhandledValue
          }
        }
      },
      true,
    ),
    reason: defineFixedToken(
      taskStatusReason.options.map(
        (value) =>
          [
            value,
            value
              .replace(/_/g, ' ')
              .replace(/^./, (char) => char.toUpperCase()),
          ] as const,
      ),
      'Filter completed tasks by completion reason.',
      (result, value) => {
        result.reason = value
      },
    ),
    label: {
      display: 'Label',
      description: 'Limit results to tasks with this label.',
      taskFilter: true,
      valuePlaceholder: 'label',
      parse: (result: ParsedQuery, value: string) => {
        result.label = value
      },
    },
    parent: {
      display: 'Parent task',
      description: 'Limit results to children of this task ID.',
      taskFilter: true,
      valuePlaceholder: 'task-id',
      parse: (result: ParsedQuery, value: string) => {
        result.parentId = value
      },
    },
    project: {
      display: 'Project',
      description: 'Limit results to tasks in this project ID.',
      taskFilter: true,
      valuePlaceholder: 'project-id',
      parse: (result: ParsedQuery, value: string) => {
        result.projectId = value
      },
    },
  } satisfies Record<string, SearchQueryTokenDefinition>),
)

export function getSearchQuerySuggestions(prefix: string, category?: string) {
  const categories =
    category == null
      ? Array.from(searchQueryTokenDefinitions.keys())
      : [category]

  return categories.flatMap((key) => {
    const definition = searchQueryTokenDefinitions.get(key)
    if (definition === undefined) return []

    const suggestions =
      'values' in definition
        ? definition.values.map(({ value, display }) => ({
            value: `${key}:${value}`,
            display,
            category: key,
          }))
        : [{ value: `${key}:`, display: definition.display, category: key }]

    return suggestions.filter((suggestion) =>
      suggestion.value.startsWith(prefix),
    )
  })
}

export function getSearchQueryHelpTokens() {
  return Array.from(searchQueryTokenDefinitions, ([key, definition]) => ({
    key,
    description: definition.description,
    taskFilter: definition.taskFilter ?? false,
    syntax:
      'values' in definition
        ? `${key}:`
        : `${key}:<${definition.valuePlaceholder}>`,
    values:
      'values' in definition
        ? definition.values.map(({ value, display }) => ({
            syntax: `${key}:${value}`,
            display,
          }))
        : [],
  }))
}

export function parseSearchQuery(q: string): ParsedQuery {
  const result: ParsedQuery = { freeText: '' }
  const freeTextParts: string[] = []

  // Split by whitespace, but respect quoted strings
  const tokens = tokenize(q)

  for (const token of tokens) {
    const colonIndex = token.indexOf(':')
    if (colonIndex === -1) {
      freeTextParts.push(token)
      continue
    }

    const prefix = token.slice(0, colonIndex).toLowerCase()
    const value = token.slice(colonIndex + 1)

    const definition = searchQueryTokenDefinitions.get(prefix)
    if (value === '' || definition === undefined) {
      freeTextParts.push(token)
      continue
    }

    if ('values' in definition) {
      const option = definition.values.find((item) => item.value === value)
      if (option === undefined) {
        freeTextParts.push(token)
      } else {
        option.parse(result)
      }
    } else {
      definition.parse(result, value)
    }
  }

  result.freeText = freeTextParts.join(' ').trim()
  return result
}

export function buildSearchQuery(query: ParsedQuery): string {
  const parts: string[] = []

  if (query.freeText !== '') {
    parts.push(query.freeText)
  }
  for (const status of query.status ?? []) {
    parts.push(`is:${status}`)
  }
  if (query.label !== undefined) {
    parts.push(`label:${quoteIfNeeded(query.label)}`)
  }
  if (query.context !== undefined) {
    parts.push(`context:${query.context}`)
  }
  if (query.commitment !== undefined) {
    parts.push(`commitment:${query.commitment}`)
  }
  if (query.reason !== undefined) {
    parts.push(`reason:${query.reason}`)
  }
  if (query.hasPages === true) {
    parts.push('has:pages')
  }
  if (query.hasComments === true) {
    parts.push('has:comments')
  }
  if (query.hasNoChildren === true) {
    parts.push('has:no-children')
  }
  if (query.hasBlockers === true) {
    parts.push('has:blockers')
  }
  if (query.hasNoBlockers === true) {
    parts.push('has:no-blockers')
  }
  if (query.parentId !== undefined) {
    parts.push(`parent:${quoteIfNeeded(query.parentId)}`)
  }
  if (query.projectId !== undefined) {
    parts.push(`project:${quoteIfNeeded(query.projectId)}`)
  }
  if (query.sortBy !== undefined) {
    parts.push(`sort:${query.sortBy}`)
  }

  return parts.join(' ')
}

// Symmetric with tokenize()'s quote handling: a value containing whitespace
// or a quote character must round-trip through parseSearchQuery as a single
// token, with embedded double quotes escaped so tokenize() doesn't treat
// them as the closing quote.
function quoteIfNeeded(value: string): string {
  return /[\s"']/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value
}

function tokenize(input: string): string[] {
  const tokens: string[] = []
  let current = ''
  let inQuote = false
  let quoteChar = ''

  for (let i = 0; i < input.length; i++) {
    const ch = input.charAt(i)
    if (inQuote) {
      if (ch === '\\' && input.charAt(i + 1) === quoteChar) {
        current += quoteChar
        i++
      } else if (ch === quoteChar) {
        inQuote = false
      } else {
        current += ch
      }
    } else if (ch === '"' || ch === "'") {
      inQuote = true
      quoteChar = ch
    } else if (ch === ' ' || ch === '\t') {
      if (current !== '') {
        tokens.push(current)
        current = ''
      }
    } else {
      current += ch
    }
  }

  if (current !== '') {
    tokens.push(current)
  }

  return tokens
}
