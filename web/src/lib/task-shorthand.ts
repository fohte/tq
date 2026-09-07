import {
  type ContextValue,
  contextValues,
} from '#components/task/create-task-modal-fields'
import { formatLocalDate } from '#lib/date-range'
import { parseDurationToMinutes } from '#lib/parse-duration'

export interface ShorthandExtraction {
  title: string
  startDate?: string
  dueDate?: string
  estimateInput?: string
  context?: ContextValue
  labels: string[]
  parentNumber?: number
}

function isContextValue(value: string): value is ContextValue {
  return (contextValues as readonly string[]).includes(value) && value !== ''
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
  if (/^\d{4}-\d{2}-\d{2}$/.test(keyword)) {
    return keyword
  }
  return null
}

/**
 * Extract completed shorthand tokens from a task title as it's being typed:
 * - `@Nm` / `@Nh` → estimateInput
 * - `@today` / `@tomorrow` / `@YYYY-MM-DD` → dueDate
 * - `>today` / `>tomorrow` / `>YYYY-MM-DD` → startDate
 * - `#label` → labels
 * - `%work` / `%personal` → context
 * - `^N` → parentNumber
 *
 * A token counts as "completed" only once it's followed by whitespace, so
 * the word currently being typed is never touched. Unrecognized tokens are
 * left in the title untouched.
 */
export function extractShorthandTokens(input: string): ShorthandExtraction {
  const endsWithSpace = /\s$/.test(input)
  const words = input.trim().split(/\s+/).filter(Boolean)

  const remaining: string[] = []
  const result: ShorthandExtraction = { title: '', labels: [] }
  let consumed = false

  for (const [i, word] of words.entries()) {
    const isLast = i === words.length - 1
    const isComplete = !isLast || endsWithSpace
    const value = word.slice(1)

    if (isComplete && value) {
      if (word.startsWith('@')) {
        const date = resolveDateKeyword(value)
        if (date != null) {
          result.dueDate = date
          consumed = true
          continue
        }
        if (parseDurationToMinutes(value) != null) {
          result.estimateInput = value
          consumed = true
          continue
        }
      } else if (word.startsWith('>')) {
        const date = resolveDateKeyword(value)
        if (date != null) {
          result.startDate = date
          consumed = true
          continue
        }
      } else if (word.startsWith('#')) {
        result.labels.push(value)
        consumed = true
        continue
      } else if (word.startsWith('%') && isContextValue(value)) {
        result.context = value
        consumed = true
        continue
      } else if (word.startsWith('^') && /^\d+$/.test(value)) {
        result.parentNumber = Number(value)
        consumed = true
        continue
      }
    }

    remaining.push(word)
  }

  if (!consumed) {
    return { title: input, labels: [] }
  }

  result.title =
    remaining.join(' ') + (endsWithSpace && remaining.length > 0 ? ' ' : '')
  return result
}

export type TriggerChar = '@' | '>' | '#' | '%' | '^'

export interface SuggestionItem {
  value: string
  display: string
}

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
]

/**
 * Find the shorthand trigger token (if any) touching the cursor, by walking
 * back from the cursor to the nearest preceding whitespace.
 */
export function detectTrigger(
  input: string,
  cursorPos: number,
): { trigger: TriggerChar; partial: string; tokenStart: number } | null {
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
    firstChar === '%' ||
    firstChar === '^'
  ) {
    return { trigger: firstChar, partial: token.slice(1), tokenStart: start }
  }

  return null
}

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
      // The shorthand syntax has no quoting mechanism, so a multi-word label
      // can't round-trip through extractShorthandTokens's whitespace split.
      items = availableLabels
        .filter((l) => !/\s/.test(l))
        .map((l) => ({ value: l, display: l }))
      break
    case '%':
      items = CONTEXT_SUGGESTIONS
      break
    case '^':
      // Real `^` suggestions come from an async server search
      // (`useTaskMentionSuggestions` in `TaskTitleInput`), not this function.
      items = []
      break
  }

  if (!partial) return items
  const lower = partial.toLowerCase()
  return items.filter((item) => item.value.toLowerCase().startsWith(lower))
}
