import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@fohte/ui/select'

import { SidebarField } from '#components/task/sidebar-field'
import type { ProjectField } from '#hooks/use-project-fields'
import { useUpdateTask } from '#hooks/use-tasks'

const UNSET_VALUE = '__unset__'

export function SidebarCustomField({
  taskId,
  field,
  optionId,
}: {
  taskId: string
  field: ProjectField
  optionId: string | undefined
}) {
  const updateTask = useUpdateTask()

  return (
    <SidebarField label={field.name}>
      <div className="px-1">
        <Select
          value={optionId ?? UNSET_VALUE}
          onValueChange={(nextOptionId) => {
            updateTask.mutate({
              id: taskId,
              input: {
                fieldValues: {
                  [field.id]:
                    nextOptionId === UNSET_VALUE ? null : nextOptionId,
                },
              },
            })
          }}
        >
          <SelectTrigger
            size="sm"
            variant="ghost"
            className="w-full justify-start"
            aria-label={field.name}
          >
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNSET_VALUE}>—</SelectItem>
            {field.options.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </SidebarField>
  )
}
