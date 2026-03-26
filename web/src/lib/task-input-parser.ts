import { parseDurationToMinutes } from '@web/lib/parse-duration'

export type TaskContext = 'work' | 'personal' | 'dev'

export interface ParsedTaskInput {
  title: string
  estimatedMinutes?: number
  dueDate?: string
  startDate?: string
  labels: string[]
  context?: TaskContext
}

const CONTEXT_VALUES: readonly TaskContext[] = ['work', 'personal', 'dev']

function isContextValue(value: string): value is TaskContext {
  return (CONTEXT_VALUES as readonly string[]).includes(value)
}

function formatLocalDate(d: Date): string {
  return `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function resolveDateKeyword(keyword: string): string | null {
  if (keyword === 'today') {
    return formatLocalDate(new Date())
  }
  if (keyword === 'tomorrow') {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return formatLocalDate(d)
  }
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(keyword)) {
    return keyword
  }
  return null
}

/**
 * Parse a quick-input string into structured task fields.
 *
 * Syntax:
 * - `@Nm` / `@Nh` → estimatedMinutes
 * - `@today` / `@tomorrow` / `@YYYY-MM-DD` → dueDate
 * - `>today` / `>tomorrow` / `>YYYY-MM-DD` → startDate
 * - `#label` → labels
 * - `%work` / `%personal` / `%dev` → context
 * - Everything else → title
 */
export function parseTaskInput(input: string): ParsedTaskInput {
  const result: ParsedTaskInput = {
    title: '',
    labels: [],
  }

  const titleParts: string[] = []

  // Tokenize by spaces, but keep multi-word intact for title
  const tokens = input.split(/\s+/).filter(Boolean)

  for (const token of tokens) {
    if (token.startsWith('@')) {
      const value = token.slice(1)
      if (!value) {
        titleParts.push(token)
        continue
      }

      // Try date first
      const date = resolveDateKeyword(value)
      if (date != null) {
        result.dueDate = date
        continue
      }

      // Try duration
      const minutes = parseDurationToMinutes(value)
      if (minutes != null) {
        result.estimatedMinutes = minutes
        continue
      }

      // Not recognized, treat as title
      titleParts.push(token)
    } else if (token.startsWith('>')) {
      const value = token.slice(1)
      if (!value) {
        titleParts.push(token)
        continue
      }

      const date = resolveDateKeyword(value)
      if (date != null) {
        result.startDate = date
      } else {
        titleParts.push(token)
      }
    } else if (token.startsWith('#')) {
      const value = token.slice(1)
      if (value) {
        result.labels.push(value)
      } else {
        titleParts.push(token)
      }
    } else if (token.startsWith('%')) {
      const value = token.slice(1)
      if (isContextValue(value)) {
        result.context = value
      } else {
        titleParts.push(token)
      }
    } else {
      titleParts.push(token)
    }
  }

  result.title = titleParts.join(' ')
  return result
}

export interface SuggestionItem {
  value: string
  display: string
}

export type TriggerChar = '@' | '>' | '#' | '%'

const AT_SUGGESTIONS: SuggestionItem[] = [
  { value: 'today', display: 'today' },
  { value: 'tomorrow', display: 'tomorrow' },
  { value: '15m', display: '15m' },
  { value: '30m', display: '30m' },
  { value: '1h', display: '1h' },
  { value: '2h', display: '2h' },
]

const START_DATE_SUGGESTIONS: SuggestionItem[] = [
  { value: 'today', display: 'today' },
  { value: 'tomorrow', display: 'tomorrow' },
]

const CONTEXT_SUGGESTIONS: SuggestionItem[] = [
  { value: 'work', display: 'work' },
  { value: 'personal', display: 'personal' },
  { value: 'dev', display: 'dev' },
]

/**
 * Detect the active trigger and partial text at the cursor position.
 * Returns null if the cursor is not on a trigger token.
 */
export function detectTrigger(
  input: string,
  cursorPos: number,
): { trigger: TriggerChar; partial: string; tokenStart: number } | null {
  // Walk backwards from cursor to find the token start
  let start = cursorPos
  while (start > 0 && input[start - 1] !== ' ') {
    start--
  }

  const token = input.slice(start, cursorPos)
  if (!token) return null

  const firstChar = token[0]
  if (
    firstChar === '@' ||
    firstChar === '>' ||
    firstChar === '#' ||
    firstChar === '%'
  ) {
    return {
      trigger: firstChar as TriggerChar,
      partial: token.slice(1),
      tokenStart: start,
    }
  }

  return null
}

/**
 * Get suggestion items for a given trigger and partial text.
 */
export function getSuggestions(
  trigger: TriggerChar,
  partial: string,
  availableLabels: string[] = [],
): SuggestionItem[] {
  let items: SuggestionItem[]

  switch (trigger) {
    case '@':
      items = AT_SUGGESTIONS
      break
    case '>':
      items = START_DATE_SUGGESTIONS
      break
    case '#':
      items = availableLabels.map((l) => ({ value: l, display: l }))
      break
    case '%':
      items = CONTEXT_SUGGESTIONS
      break
  }

  if (!partial) return items
  const lower = partial.toLowerCase()
  return items.filter((item) => item.value.toLowerCase().startsWith(lower))
}
