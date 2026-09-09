import {
  type ContextValue,
  contextValues,
} from '#components/task/create-task-modal-fields'
import { formatLocalDate } from '#lib/date-range'
import { parseDurationToMinutes } from '#lib/parse-duration'

export interface ShorthandRecurrenceRule {
  type: 'daily' | 'weekly' | 'monthly'
  interval: number
  daysOfWeek?: number[]
}

export interface ShorthandExtraction {
  title: string
  startDate?: string
  dueDate?: string
  estimateInput?: string
  context?: ContextValue
  labels: string[]
  parentNumber?: number
  githubUrl?: string
  recurrenceRule?: ShorthandRecurrenceRule
}

function isContextValue(value: string): value is ContextValue {
  return (contextValues as readonly string[]).includes(value) && value !== ''
}

const GITHUB_URL_RE =
  /^(https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/(?:issues|pull)\/\d+\/?)(?:[?#]\S*)?$/

// The closed vocabulary behind `*` tokens: 3 recurrence types + 7 weekdays,
// each with an English and Japanese spelling. `*月` is deliberately absent
// from both tables since it reads as either "月曜" (Monday) or "毎月"
// (monthly) with no way to disambiguate.
const RECURRENCE_TYPE_ALIASES: Record<string, 'daily' | 'weekly' | 'monthly'> =
  {
    daily: 'daily',
    weekly: 'weekly',
    monthly: 'monthly',
    毎日: 'daily',
    毎週: 'weekly',
    毎月: 'monthly',
  }

const WEEKDAY_ALIASES: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
  日曜: 0,
  月曜: 1,
  火曜: 2,
  水曜: 3,
  木曜: 4,
  金曜: 5,
  土曜: 6,
}

function resolveRecurrenceKeyword(
  keyword: string,
): { type: 'daily' | 'weekly' | 'monthly' } | { day: number } | null {
  const type = RECURRENCE_TYPE_ALIASES[keyword]
  if (type != null) return { type }
  const day = WEEKDAY_ALIASES[keyword]
  if (day != null) return { day }
  return null
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
 * - a GitHub issue/PR URL → githubUrl
 * - `*daily` / `*weekly` / `*monthly` / `*sun`…`*sat` (English or Japanese
 *   alias) → recurrenceRule; multiple weekday tokens accumulate into one
 *   weekly rule's daysOfWeek
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
  let recurrenceType: 'daily' | 'weekly' | 'monthly' | undefined
  const recurrenceDays = new Set<number>()

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
      } else if (word.startsWith('*')) {
        const resolved = resolveRecurrenceKeyword(value)
        if (resolved != null) {
          if ('day' in resolved) {
            recurrenceType = 'weekly'
            recurrenceDays.add(resolved.day)
          } else {
            recurrenceType = resolved.type
          }
          consumed = true
          continue
        }
      } else {
        const githubMatch = GITHUB_URL_RE.exec(word)
        if (githubMatch != null) {
          result.githubUrl = githubMatch[1] ?? word
          consumed = true
          continue
        }
      }
    }

    remaining.push(word)
  }

  if (!consumed) {
    return { title: input, labels: [] }
  }

  if (recurrenceType != null) {
    result.recurrenceRule = {
      type: recurrenceType,
      interval: 1,
      ...(recurrenceDays.size > 0
        ? { daysOfWeek: [...recurrenceDays].sort((a, b) => a - b) }
        : {}),
    }
  }

  result.title =
    remaining.join(' ') + (endsWithSpace && remaining.length > 0 ? ' ' : '')
  return result
}

export type TriggerChar = '@' | '>' | '#' | '%' | '^' | '*'

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

const RECURRENCE_SUGGESTIONS: SuggestionItem[] = [
  { value: 'daily', display: 'daily' },
  { value: 'weekly', display: 'weekly' },
  { value: 'monthly', display: 'monthly' },
  { value: 'sun', display: 'sun' },
  { value: 'mon', display: 'mon' },
  { value: 'tue', display: 'tue' },
  { value: 'wed', display: 'wed' },
  { value: 'thu', display: 'thu' },
  { value: 'fri', display: 'fri' },
  { value: 'sat', display: 'sat' },
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
    firstChar === '^' ||
    firstChar === '*'
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
      // Parent suggestions require an async lookup this function can't do.
      items = []
      break
    case '*':
      items = RECURRENCE_SUGGESTIONS
      break
  }

  if (!partial) return items
  const lower = partial.toLowerCase()
  return items.filter((item) => item.value.toLowerCase().startsWith(lower))
}

/**
 * Parse a recurrence-only input (the sidebar's recurrence text field) with
 * the same `*` grammar as extractShorthandTokens, except the leading `*` is
 * optional since there's no surrounding title text to disambiguate from.
 *
 * Every word is padded with a trailing space before being handed to
 * extractShorthandTokens, so a token here counts as "completed" as soon as
 * it's typed rather than only once followed by whitespace — appropriate
 * for a field with no trailing title text a word-in-progress could still
 * become part of.
 */
export function parseRecurrenceShorthand(
  input: string,
): ShorthandRecurrenceRule | undefined {
  const words = input
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => (word.startsWith('*') ? word : `*${word}`))
  if (words.length === 0) return undefined
  return extractShorthandTokens(`${words.join(' ')} `).recurrenceRule
}
