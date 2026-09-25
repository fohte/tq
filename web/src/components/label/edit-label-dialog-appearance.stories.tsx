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

export const Default: Story = {
  name: 'the label editor shows an existing label name and color',
}

export const EmptyName: Story = {
  name: 'the label editor disables saving when the name is empty',
  args: {
    name: '',
    saveDisabled: true,
  },
}

export const NameConflictError: Story = {
  name: 'the label editor shows an error for a duplicate name',
  args: {
    name: 'urgent',
    errorMessage: 'A label with this name already exists',
  },
}
