import { List, ListItem } from '@fohte/ui/list'

import type {
  PrioritySetting,
  TaskPriority,
} from '#hooks/use-priority-settings'

export function TaskPriorityFilterFields({
  priority,
  settings,
  onPriorityChange,
}: {
  priority: TaskPriority
  settings: PrioritySetting[]
  onPriorityChange: (priority: TaskPriority) => void
}) {
  return (
    <List>
      {[...settings]
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((setting) => (
          <ListItem
            key={setting.priority ?? 'inbox'}
            selected={priority === setting.priority}
            onSelect={() => {
              onPriorityChange(setting.priority)
            }}
          >
            {setting.name}
          </ListItem>
        ))}
    </List>
  )
}
