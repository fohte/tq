import { useCallback, useEffect, useState } from 'react'

import { CreateTaskModalProjectFields } from '#components/task/create-task-modal-project-fields'
import { useProjectFields } from '#hooks/use-project-fields'

export function useCreateTaskModalProjectFieldsState(
  projectId: string | undefined,
  open: boolean,
  recurring: boolean,
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
  const onRetry = () => {
    void query.refetch()
  }
  const commonProps = {
    fields,
    values,
    onValueChange,
    isLoading: projectId != null && query.isLoading,
    loadError: projectId != null && query.isError,
    onRetry,
    recurring,
  }
  const input = <CreateTaskModalProjectFields {...commonProps} />
  const compactInput = <CreateTaskModalProjectFields {...commonProps} compact />

  return {
    values,
    reset,
    input,
    compactInput,
    isReady: projectId == null || query.isSuccess,
  }
}
