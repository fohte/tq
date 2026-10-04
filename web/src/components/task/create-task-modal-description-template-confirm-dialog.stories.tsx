import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { CreateTaskModalDescriptionTemplateConfirmDialog } from '#components/task/create-task-modal-description-template-confirm-dialog'

const meta = {
  title: 'Task/CreateTaskModalDescriptionTemplateConfirmDialog',
  component: CreateTaskModalDescriptionTemplateConfirmDialog,
  parameters: { layout: 'centered' },
  args: {
    open: true,
    onOpenChange: fn(),
    onConfirm: fn(),
  },
} satisfies Meta<typeof CreateTaskModalDescriptionTemplateConfirmDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Open: Story = {
  name: 'asks before replacing the current description',
}
