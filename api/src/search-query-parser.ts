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

const STATUS_VALUES = new Set(['todo', 'in_progress', 'completed'])
const CONTEXT_VALUES = new Set(['work', 'personal', 'dev'])
const SORT_VALUES = new Set(['due', 'created', 'updated', 'estimate'])

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
        if (STATUS_VALUES.has(value)) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- validated by Set.has() above
          result.status = value as 'todo' | 'in_progress' | 'completed'
        } else {
          freeTextParts.push(token)
        }
        break
      case 'label':
        result.label = value
        break
      case 'context':
        if (CONTEXT_VALUES.has(value)) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- validated by Set.has() above
          result.context = value as 'work' | 'personal' | 'dev'
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
        if (SORT_VALUES.has(value)) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- validated by Set.has() above
          result.sortBy = value as 'due' | 'created' | 'updated' | 'estimate'
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
