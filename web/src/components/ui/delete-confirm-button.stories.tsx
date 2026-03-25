import type { Meta, StoryObj } from '@storybook/react-vite'
import { DeleteConfirmButton } from '@web/components/ui/delete-confirm-button'

const meta = {
  title: 'UI/DeleteConfirmButton',
  component: DeleteConfirmButton,
} satisfies Meta<typeof DeleteConfirmButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    title: 'Delete item',
    description:
      'Are you sure you want to delete this item? This action cannot be undone.',
    onDelete: () => {},
  },
}

export const SmallIcon: Story = {
  args: {
    title: 'Delete comment',
    description:
      'Are you sure you want to delete this comment? This action cannot be undone.',
    onDelete: () => {},
    iconClassName: 'size-3',
  },
}

export const DialogOpen: Story = {
  args: {
    title: 'Delete item',
    description:
      'Are you sure you want to delete this item? This action cannot be undone.',
    onDelete: () => {},
    open: true,
  },
}

export const Disabled: Story = {
  args: {
    title: 'Delete item',
    description: 'This action cannot be undone.',
    onDelete: () => {},
    disabled: true,
  },
}
