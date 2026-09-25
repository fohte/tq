import type { Meta, StoryObj } from '@storybook/react-vite'

import { DeleteConfirmButton } from '#components/ui/delete-confirm-button'

const meta = {
  title: 'UI/DeleteConfirmButton',
  component: DeleteConfirmButton,
} satisfies Meta<typeof DeleteConfirmButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'shows a delete button for a generic item',
  args: {
    title: 'Delete item',
    description:
      'Are you sure you want to delete this item? This action cannot be undone.',
    onDelete: () => {},
  },
}

export const SmallIcon: Story = {
  name: 'shows a compact delete button for a comment',
  args: {
    title: 'Delete comment',
    description:
      'Are you sure you want to delete this comment? This action cannot be undone.',
    onDelete: () => {},
    iconClassName: 'size-3',
  },
}

export const DialogOpen: Story = {
  name: 'shows the delete confirmation dialog for an item',
  args: {
    title: 'Delete item',
    description:
      'Are you sure you want to delete this item? This action cannot be undone.',
    onDelete: () => {},
    open: true,
  },
}

export const Disabled: Story = {
  name: 'shows a disabled delete button',
  args: {
    title: 'Delete item',
    description: 'This action cannot be undone.',
    onDelete: () => {},
    disabled: true,
  },
}
