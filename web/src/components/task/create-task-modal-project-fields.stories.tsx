import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { makeProjectField } from '#components/project/project-test-fixtures'
import { CreateTaskModalProjectFields } from '#components/task/create-task-modal-project-fields'

const deliveryField = makeProjectField({
  id: 'field-delivery-zone',
  name: 'DeliveryZone',
  options: [
    { id: 'option-coastal', name: 'Coastal' },
    { id: 'option-inland', name: 'Inland' },
  ],
})
const supportField = makeProjectField({
  id: 'field-support-tier',
  name: 'SupportTier',
  options: [
    { id: 'option-standard', name: 'Standard' },
    { id: 'option-priority', name: 'Priority' },
  ],
})

const meta = {
  title: 'Task/CreateTaskModalProjectFields',
  component: CreateTaskModalProjectFields,
  args: {
    fields: [deliveryField, supportField],
    values: { [deliveryField.id]: 'option-coastal' },
    onValueChange: fn(),
  },
} satisfies Meta<typeof CreateTaskModalProjectFields>

export default meta
type Story = StoryObj<typeof meta>

export const Desktop: Story = {
  name: 'the desktop form shows configured fields and selected options',
}

export const Mobile: Story = {
  name: 'the mobile form shows configured fields as editable chips',
  args: { compact: true },
}
