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
