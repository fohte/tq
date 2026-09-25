import type { Dispatch, SetStateAction } from 'react'

import type {
  ContextValue,
  PlanValue,
} from '#components/task/create-task-modal-fields'
import {
  extractShorthandTokens,
  type ShorthandRecurrenceRule,
} from '#lib/task-shorthand'

interface CreateTaskModalTitleChangeHandlerOptions {
  setTitle: Dispatch<SetStateAction<string>>
  setStartDate: Dispatch<SetStateAction<string>>
  setDueDate: Dispatch<SetStateAction<string>>
  setEstimateInput: Dispatch<SetStateAction<string>>
  setContext: Dispatch<SetStateAction<ContextValue | ''>>
  setLabels: Dispatch<SetStateAction<string[]>>
  setParentOverrideNumber: Dispatch<SetStateAction<number | undefined>>
  setGithubUrl: Dispatch<SetStateAction<string | undefined>>
  setPlan: Dispatch<SetStateAction<PlanValue | ''>>
  setRecurrenceRule: Dispatch<
    SetStateAction<ShorthandRecurrenceRule | undefined>
  >
}

export function createTaskModalTitleChangeHandler({
  setTitle,
  setStartDate,
  setDueDate,
  setEstimateInput,
  setContext,
  setLabels,
  setParentOverrideNumber,
  setGithubUrl,
  setPlan,
  setRecurrenceRule,
}: CreateTaskModalTitleChangeHandlerOptions) {
  // Stripping a consumed token resets the input's caret to the end of the
  // (now shorter) title, since the value change isn't a plain append. Fine
  // for the common case of appending a shorthand token while typing; jarring
  // if a token is completed with the caret positioned mid-title.
  return (value: string) => {
    const parsed = extractShorthandTokens(value)
    setTitle(parsed.title)
    if (parsed.startDate != null) setStartDate(parsed.startDate)
    if (parsed.dueDate != null) setDueDate(parsed.dueDate)
    if (parsed.estimateInput != null) setEstimateInput(parsed.estimateInput)
    if (parsed.context != null) setContext(parsed.context)
    if (parsed.labels.length > 0) {
      setLabels((prev) => [...new Set([...prev, ...parsed.labels])])
    }
    if (parsed.parentNumber != null)
      setParentOverrideNumber(parsed.parentNumber)
    if (parsed.githubUrl != null) setGithubUrl(parsed.githubUrl)
    if (parsed.plan != null) setPlan(parsed.plan)
    if (parsed.recurrenceRule != null) {
      // Each completed `*` token is stripped from the title before the next
      // one is typed (see the comment above), so a second `*weekday` token
      // is parsed from a string that no longer contains the first — merge
      // with the previous rule instead of replacing it, mirroring labels.
      const parsedRule = parsed.recurrenceRule
      setRecurrenceRule((prev) =>
        prev?.type === 'weekly' && parsedRule.type === 'weekly'
          ? {
              ...parsedRule,
              daysOfWeek: [
                ...new Set([
                  ...(prev.daysOfWeek ?? []),
                  ...(parsedRule.daysOfWeek ?? []),
                ]),
              ].sort((a, b) => a - b),
            }
          : parsedRule,
      )
    }
  }
}
