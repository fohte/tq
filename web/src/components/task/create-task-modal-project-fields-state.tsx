import { useCallback, useEffect, useState } from 'react'

import { CreateTaskModalProjectFields } from '#components/task/create-task-modal-project-fields'
import { useProjectFields } from '#hooks/use-project-fields'

export function useCreateTaskModalProjectFieldsState(
  projectId: string | undefined,
  open: boolean,
) {
  const [values, setValues] = useState<Record<string, string>>({})
  const query = useProjectFields(projectId ?? '', {
    enabled: open && projectId != null,
  })

  useEffect(() => {
    setValues({})
  }, [projectId])

  useEffect(() => {
    if (!open) setValues({})
  }, [open])

  const reset = useCallback(() => {
    setValues({})
  }, [])

  const onValueChange = (fieldId: string, optionId: string) => {
    setValues((current) => {
      if (optionId === '') {
        return Object.fromEntries(
          Object.entries(current).filter(
            ([currentFieldId]) => currentFieldId !== fieldId,
          ),
        )
      }
      return { ...current, [fieldId]: optionId }
    })
  }

  const fields = query.data ?? []
  const input = (
    <CreateTaskModalProjectFields
      fields={fields}
      values={values}
      onValueChange={onValueChange}
    />
  )
  const compactInput = (
    <CreateTaskModalProjectFields
      fields={fields}
      values={values}
      onValueChange={onValueChange}
      compact
    />
  )

  return { values, reset, input, compactInput }
}
