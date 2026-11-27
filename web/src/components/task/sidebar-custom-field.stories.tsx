import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import {
  makeProjectField,
  makeProjectFieldOption,
} from '#components/project/project-test-fixtures'
import { SidebarCustomField } from '#components/task/sidebar-custom-field'

const field = makeProjectField({
  name: 'DeliveryStage',
  options: [
    makeProjectFieldOption({ id: 'option-triage', name: 'Triage' }),
    makeProjectFieldOption({ id: 'option-review', name: 'Review' }),
  ],
})

function Providers({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient()
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

function SidebarCustomFieldStory({
  optionId,
}: {
  optionId: string | undefined
}) {
  return (
    <Providers>
      <div className="w-60 border-l border-border p-4">
        <SidebarCustomField
          taskId="00000000-0000-0000-0000-000000000001"
          field={field}
          optionId={optionId}
        />
      </div>
    </Providers>
  )
}

const meta = {
  title: 'Task/TaskDetail/SidebarCustomField',
  component: SidebarCustomFieldStory,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof SidebarCustomFieldStory>

export default meta
type Story = StoryObj<typeof meta>

export const Selected: Story = {
  name: 'a project custom field shows its selected option',
  args: { optionId: field.options[1]?.id },
}

export const Unset: Story = {
  name: 'an unset project custom field shows a dash',
  args: { optionId: undefined },
}
