import type {
  PrioritySetting,
  TaskPriority,
} from '#hooks/use-priority-settings'

export function findPrioritySettingName(
  settings: PrioritySetting[] | undefined,
  priority: TaskPriority,
) {
  return settings?.find((setting) => setting.priority === priority)?.name
}

export function priorityToken(priority: TaskPriority): string {
  return `priority:${priority === null ? 'none' : String(priority)}`
}

export function sortByPrioritySettings<T>(
  values: readonly T[],
  settings: readonly PrioritySetting[] | undefined,
  getToken: (value: T) => string,
): T[] {
  const sortOrderByToken = new Map(
    settings?.map((setting) => [
      priorityToken(setting.priority),
      setting.sortOrder,
    ]),
  )

  return [...values].sort(
    (left, right) =>
      (sortOrderByToken.get(getToken(left)) ?? Infinity) -
      (sortOrderByToken.get(getToken(right)) ?? Infinity),
  )
}

export function priorityName(
  settings: PrioritySetting[] | undefined,
  priority: TaskPriority,
) {
  return (
    findPrioritySettingName(settings, priority) ??
    (priority === null ? 'Inbox' : 'Priority')
  )
}
