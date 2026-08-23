import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'

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
    onDelete: fn(),
  },
} satisfies Meta<typeof DeleteConfirmDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Open: Story = {
  args: {
    open: true,
  },
}

export const WithTrigger: Story = {
  args: {
    children: (
      <DialogTrigger render={<Button variant="outline" />}>
        Delete item
      </DialogTrigger>
    ),
  },
  play: async ({ canvasElement, userEvent, args }) => {
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(body.getByRole('button', { name: 'Delete item' }))
    await userEvent.click(await body.findByRole('button', { name: 'Delete' }))

    await expect(args.onDelete).toHaveBeenCalled()
  },
}
