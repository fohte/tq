import { Button } from '@fohte/ui/button'
import { SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'

import { ProjectFieldsManagerDialog } from '#components/project/project-fields-manager-dialog'
import {
  useCreateProjectField,
  useCreateProjectFieldOption,
  useDeleteProjectField,
  useDeleteProjectFieldOption,
  useProjectFields,
  useUpdateProjectField,
  useUpdateProjectFieldOption,
} from '#hooks/use-project-fields'

export function ProjectFieldsManager({
  projectId,
  mobileLayout = false,
}: {
  projectId: string
  mobileLayout?: boolean
}) {
  const [open, setOpen] = useState(false)
  const fields = useProjectFields(projectId, { enabled: open })
  const createField = useCreateProjectField(projectId)
  const updateField = useUpdateProjectField(projectId)
  const deleteField = useDeleteProjectField(projectId)
  const createOption = useCreateProjectFieldOption(projectId)
  const updateOption = useUpdateProjectFieldOption(projectId)
  const deleteOption = useDeleteProjectFieldOption(projectId)

  return (
    <>
      <Button
        type="button"
        variant={mobileLayout ? 'outline' : 'ghost'}
        size="sm"
        className="w-full justify-start"
        onClick={() => {
          setOpen(true)
        }}
      >
        <SlidersHorizontal className="size-4" />
        フィールド
      </Button>
      <ProjectFieldsManagerDialog
        open={open}
        onOpenChange={setOpen}
        fields={fields.data ?? []}
        isLoading={fields.isLoading}
        loadError={fields.isError}
        onCreateField={async (name) => {
          await createField.mutateAsync({ name })
        }}
        onRenameField={async (fieldId, name) => {
          await updateField.mutateAsync({ fieldId, name })
        }}
        onDeleteField={async (fieldId) => {
          await deleteField.mutateAsync(fieldId)
        }}
        onCreateOption={async (fieldId, name) => {
          await createOption.mutateAsync({ fieldId, name })
        }}
        onRenameOption={async (fieldId, optionId, name) => {
          await updateOption.mutateAsync({ fieldId, optionId, name })
        }}
        onDeleteOption={async (fieldId, optionId) => {
          await deleteOption.mutateAsync({ fieldId, optionId })
        }}
      />
    </>
  )
}
