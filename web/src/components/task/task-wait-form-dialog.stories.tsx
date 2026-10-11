import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { TaskWaitFormDialog } from '#components/task/task-wait-form-dialog'

const meta = {
  title: 'Task/TaskWaitFormDialog',
  component: TaskWaitFormDialog,
  parameters: {
    layout: 'centered',
  },
  args: {
    open: true,
    onOpenChange: fn(),
    body: 'Review the proposal\n\nPlease confirm the updated timeline.',
    followUpDate: '2099-10-13',
    onBodyChange: fn(),
    onFollowUpDateChange: fn(),
    onSubmit: fn(),
  },
} satisfies Meta<typeof TaskWaitFormDialog>

export default meta
type Story = StoryObj<typeof meta>

export const AddWait: Story = {
  name: 'the dialog is ready to add a Markdown reply wait',
}
