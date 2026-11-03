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

export function priorityName(
  settings: PrioritySetting[] | undefined,
  priority: TaskPriority,
) {
  return (
    findPrioritySettingName(settings, priority) ??
    (priority === null ? 'Inbox' : 'Priority')
  )
}
