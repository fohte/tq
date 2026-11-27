import { SidebarCustomField } from '#components/task/sidebar-custom-field'
import { useProjectFields } from '#hooks/use-project-fields'

export function SidebarProjectCustomFields({
  taskId,
  projectId,
  fieldValues,
  mobile = false,
}: {
  taskId: string
  projectId: string | null
  fieldValues: Array<{ fieldId: string; optionId: string }>
  mobile?: boolean
}) {
  if (projectId == null) return null
  return (
    <SidebarProjectCustomFieldsForProject
      taskId={taskId}
      projectId={projectId}
      fieldValues={fieldValues}
      mobile={mobile}
    />
  )
}

function SidebarProjectCustomFieldsForProject({
  taskId,
  projectId,
  fieldValues,
  mobile,
}: {
  taskId: string
  projectId: string
  fieldValues: Array<{ fieldId: string; optionId: string }>
  mobile: boolean
}) {
  const fields = useProjectFields(projectId)

  return (fields.data ?? []).map((field) => {
    const content = (
      <SidebarCustomField
        taskId={taskId}
        field={field}
        optionId={
          fieldValues.find((value) => value.fieldId === field.id)?.optionId
        }
      />
    )

    return mobile ? (
      <div
        key={field.id}
        className="col-span-2 border-b border-border p-2.5 last:border-b-0"
      >
        {content}
      </div>
    ) : (
      <div key={field.id}>{content}</div>
    )
  })
}
