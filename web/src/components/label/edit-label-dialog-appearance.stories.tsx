import type { Meta, StoryObj } from '@storybook/react-vite'

import { EditLabelDialogAppearance } from '#components/label/edit-label-dialog'

const meta = {
  title: 'Label/EditLabelDialogAppearance',
  component: EditLabelDialogAppearance,
  parameters: {
    layout: 'centered',
  },
  args: {
    open: true,
    onOpenChange: () => {},
    name: 'oncall',
    context: 'work',
    errorMessage: null,
    saveDisabled: false,
    onNameChange: () => {},
    onContextChange: () => {},
    onSubmit: () => {},
  },
} satisfies Meta<typeof EditLabelDialogAppearance>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const EmptyName: Story = {
  args: {
    name: '',
    saveDisabled: true,
  },
}

export const NameConflictError: Story = {
  args: {
    name: 'urgent',
    errorMessage: 'A label with this name already exists',
  },
}
