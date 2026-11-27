import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@fohte/ui/select'
import { useEffect, useState } from 'react'

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
  const [selectedOptionId, setSelectedOptionId] = useState(
    optionId ?? UNSET_VALUE,
  )
  const selectedOption = field.options.find(({ id }) => id === selectedOptionId)

  useEffect(() => {
    setSelectedOptionId(optionId ?? UNSET_VALUE)
  }, [optionId])

  return (
    <SidebarField label={field.name}>
      <div className="px-1">
        <Select
          value={selectedOptionId}
          disabled={updateTask.isPending}
          onValueChange={(nextOptionId) => {
            const normalizedNextOptionId = nextOptionId ?? UNSET_VALUE
            const previousOptionId = selectedOptionId
            setSelectedOptionId(normalizedNextOptionId)
            updateTask.mutate(
              {
                id: taskId,
                input: {
                  fieldValues: {
                    [field.id]:
                      normalizedNextOptionId === UNSET_VALUE
                        ? null
                        : normalizedNextOptionId,
                  },
                },
              },
              {
                onError: () => {
                  setSelectedOptionId(previousOptionId)
                },
              },
            )
          }}
        >
          <SelectTrigger
            size="sm"
            variant="ghost"
            className="w-full justify-start"
            aria-label={field.name}
          >
            <SelectValue>{selectedOption?.name ?? '—'}</SelectValue>
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
