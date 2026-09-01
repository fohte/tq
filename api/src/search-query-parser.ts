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
  parentId?: string
  projectId?: string
  sortBy?: 'due' | 'created' | 'updated' | 'estimate'
}

const STATUS_VALUES: ReadonlySet<'todo' | 'completed'> = new Set([
  'todo',
  'completed',
])
const REASON_VALUES: ReadonlySet<TaskStatusReason> = new Set(
  taskStatusReason.options,
)
const CONTEXT_VALUES: ReadonlySet<'work' | 'personal'> = new Set([
  'work',
  'personal',
])
const COMMITMENT_VALUES: ReadonlySet<'inbox' | 'active' | 'someday'> = new Set([
  'inbox',
  'active',
  'someday',
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
          result.status = [...(result.status ?? []), value]
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
      case 'commitment':
        if (isOneOf(value, COMMITMENT_VALUES)) {
          result.commitment = value
        } else {
          freeTextParts.push(token)
        }
        break
      case 'reason':
        if (isOneOf(value, REASON_VALUES)) {
          result.reason = value
        } else {
          freeTextParts.push(token)
        }
        break
      case 'has':
        if (value === 'pages') {
          result.hasPages = true
        } else if (value === 'comments') {
          result.hasComments = true
        } else if (value === 'no-children') {
          result.hasNoChildren = true
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
