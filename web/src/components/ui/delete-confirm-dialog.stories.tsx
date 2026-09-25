import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { Button } from '#components/ui/button'
import { DeleteConfirmDialog } from '#components/ui/delete-confirm-dialog'
import { DialogTrigger } from '#components/ui/dialog'

const meta = {
  title: 'UI/DeleteConfirmDialog',
  component: DeleteConfirmDialog,
  parameters: {
    layout: 'centered',
  },
  args: {
    title: 'Delete item',
    description:
      'Are you sure you want to delete this item? This action cannot be undone.',
    onConfirm: fn(),
  },
} satisfies Meta<typeof DeleteConfirmDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Open: Story = {
  name: 'shows the delete confirmation dialog and its warning',
  args: {
    open: true,
  },
}

export const WithTrigger: Story = {
  name: 'shows a delete item trigger before confirmation',
  args: {
    children: (
      <DialogTrigger render={<Button variant="outline" />}>
        Delete item
      </DialogTrigger>
    ),
  },
}
