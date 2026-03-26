export interface ParsedQuery {
  freeText: string
  status?: 'todo' | 'in_progress' | 'completed'
  label?: string
  context?: 'work' | 'personal' | 'dev'
  hasPages?: boolean
  hasComments?: boolean
  parentId?: string
  projectId?: string
  sortBy?: 'due' | 'created' | 'updated' | 'estimate'
}

const STATUS_VALUES: ReadonlySet<'todo' | 'in_progress' | 'completed'> =
  new Set(['todo', 'in_progress', 'completed'])
const CONTEXT_VALUES: ReadonlySet<'work' | 'personal' | 'dev'> = new Set([
  'work',
  'personal',
  'dev',
])
const SORT_VALUES: ReadonlySet<'due' | 'created' | 'updated' | 'estimate'> =
  new Set(['due', 'created', 'updated', 'estimate'])

function isOneOf<T extends string>(
  value: string,
  set: ReadonlySet<T>,
): value is T {
  return (set as ReadonlySet<string>).has(value)
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

    if (value === '') {
      freeTextParts.push(token)
      continue
    }

    switch (prefix) {
      case 'is':
        if (isOneOf(value, STATUS_VALUES)) {
          result.status = value
        } else {
          freeTextParts.push(token)
        }
        break
      case 'label':
        result.label = value
        break
      case 'context':
        if (isOneOf(value, CONTEXT_VALUES)) {
          result.context = value
        } else {
          freeTextParts.push(token)
        }
        break
      case 'has':
        if (value === 'pages') {
          result.hasPages = true
        } else if (value === 'comments') {
          result.hasComments = true
        } else {
          freeTextParts.push(token)
        }
        break
      case 'parent':
        result.parentId = value
        break
      case 'project':
        result.projectId = value
        break
      case 'sort':
        if (isOneOf(value, SORT_VALUES)) {
          result.sortBy = value
        } else {
          freeTextParts.push(token)
        }
        break
      default:
        freeTextParts.push(token)
    }
  }

  result.freeText = freeTextParts.join(' ').trim()
  return result
}

function tokenize(input: string): string[] {
  const tokens: string[] = []
  let current = ''
  let inQuote = false
  let quoteChar = ''

  for (const ch of input) {
    if (inQuote) {
      if (ch === quoteChar) {
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
