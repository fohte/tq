import type { Meta, StoryObj } from '@storybook/react-vite'

import { RenameSavedViewDialogAppearance } from '#components/saved-view/rename-saved-view-dialog'

const meta = {
  title: 'SavedView/RenameSavedViewDialogAppearance',
  component: RenameSavedViewDialogAppearance,
  parameters: {
    layout: 'centered',
  },
  args: {
    open: true,
    onOpenChange: () => {},
    name: 'Now',
    errorMessage: null,
    saveDisabled: false,
    onNameChange: () => {},
    onSubmit: () => {},
  },
} satisfies Meta<typeof RenameSavedViewDialogAppearance>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'the rename dialog shows an existing saved view name',
}

export const EmptyNameDisablesSave: Story = {
  name: 'the rename dialog disables saving when the name is empty',
  args: {
    name: '',
    saveDisabled: true,
  },
}
