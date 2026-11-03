import type { PrioritySetting } from '#hooks/use-priority-settings'
import { priorityName } from '#lib/priority-settings'

interface SearchSuggestion {
  value: string
  display: string
  category: string
}

export function applyPrioritySettingsToSuggestions<T extends SearchSuggestion>(
  suggestions: readonly T[] | undefined,
  settings: PrioritySetting[] | undefined,
): T[] | undefined {
  if (suggestions == null) return undefined

  const settingsByToken = new Map(
    settings?.map((setting) => [
      `priority:${setting.priority === null ? 'none' : String(setting.priority)}`,
      setting,
    ]),
  )
  const suggestionsWithNames = suggestions.map((suggestion) => {
    if (suggestion.category !== 'priority') return suggestion

    const value = suggestion.value.slice('priority:'.length)
    const priority = value === 'none' ? null : Number(value)
    return {
      ...suggestion,
      display: priorityName(settings, priority),
    }
  })
  const sortedPrioritySuggestions = suggestionsWithNames
    .filter((suggestion) => suggestion.category === 'priority')
    .sort(
      (left, right) =>
        (settingsByToken.get(left.value)?.sortOrder ?? Infinity) -
        (settingsByToken.get(right.value)?.sortOrder ?? Infinity),
    )
  const result = [...suggestionsWithNames]
  const prioritySlots = result.flatMap((suggestion, index) =>
    suggestion.category === 'priority' ? [index] : [],
  )

  prioritySlots.forEach((slot, index) => {
    const suggestion = sortedPrioritySuggestions[index]
    if (suggestion != null) result[slot] = suggestion
  })

  return result
}
