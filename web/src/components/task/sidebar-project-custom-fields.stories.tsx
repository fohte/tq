import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { makeProjectField } from '#components/project/project-test-fixtures'
import { SidebarProjectCustomFields } from '#components/task/sidebar-project-custom-fields'
import type { ProjectField } from '#hooks/use-project-fields'
import { projectKeys } from '#hooks/use-projects'

const projectId = '00000000-0000-0000-0000-000000000301'
const categoryField = makeProjectField({
  id: 'field-category',
  projectId,
  name: 'DeliveryStage',
  options: [{ id: 'option-ready', name: 'Ready' }],
})

function SidebarProjectCustomFieldsStory({
  fields,
  fieldValues,
  mobile = false,
}: {
  fields: ProjectField[]
  fieldValues: Array<{ fieldId: string; optionId: string }>
  mobile?: boolean
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  queryClient.setQueryData(projectKeys.fields(projectId), fields)
  return (
    <QueryClientProvider client={queryClient}>
      <div className={mobile ? 'grid grid-cols-2 border' : 'w-60 p-4'}>
        <SidebarProjectCustomFields
          taskId="00000000-0000-0000-0000-000000000302"
          projectId={projectId}
          fieldValues={fieldValues}
          mobile={mobile}
        />
      </div>
    </QueryClientProvider>
  )
}

const meta = {
  title: 'Task/TaskDetail/SidebarProjectCustomFields',
  component: SidebarProjectCustomFieldsStory,
  args: {
    fields: [categoryField],
    fieldValues: [{ fieldId: categoryField.id, optionId: 'option-ready' }],
  },
  parameters: { layout: 'centered' },
} satisfies Meta<typeof SidebarProjectCustomFieldsStory>

export default meta
type Story = StoryObj<typeof meta>

export const Desktop: Story = {
  name: 'the desktop sidebar shows configured project fields',
}

export const Mobile: Story = {
  name: 'the mobile sidebar places project fields across the grid',
  args: { mobile: true },
}
