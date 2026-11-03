import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@fohte/ui/select'

import type {
  PrioritySetting,
  TaskPriority,
} from '#hooks/use-priority-settings'

export function priorityName(
  settings: PrioritySetting[] | undefined,
  priority: TaskPriority,
) {
  return (
    settings?.find((setting) => setting.priority === priority)?.name ??
    (priority === null ? 'Inbox' : 'Priority')
  )
}

export function PrioritySelect({
  value,
  settings,
  onValueChange,
  onValueChangeComplete,
  className,
}: {
  value: TaskPriority
  settings: PrioritySetting[] | undefined
  onValueChange: (priority: TaskPriority) => void
  onValueChangeComplete?: (() => void) | undefined
  className?: string | undefined
}) {
  const selectedValue = value === null ? 'inbox' : String(value)

  return (
    <Select
      value={selectedValue}
      onValueChange={(nextValue) => {
        if (nextValue === 'inbox') {
          onValueChange(null)
          onValueChangeComplete?.()
          return
        }
        const setting = settings?.find(
          (candidate) =>
            candidate.priority !== null &&
            String(candidate.priority) === nextValue,
        )
        if (setting) {
          onValueChange(setting.priority)
          onValueChangeComplete?.()
        }
      }}
    >
      <SelectTrigger
        aria-label="Priority"
        variant="ghost"
        size="sm"
        className={className}
      >
        <SelectValue placeholder={priorityName(settings, value)} />
      </SelectTrigger>
      <SelectContent>
        {[...(settings ?? [])]
          .sort((left, right) => left.sortOrder - right.sortOrder)
          .map((setting) => (
            <SelectItem
              key={setting.priority ?? 'inbox'}
              value={
                setting.priority === null ? 'inbox' : String(setting.priority)
              }
            >
              {setting.name}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  )
}
