import type { Meta, StoryObj } from '@storybook/react-vite'

import { PrioritySettingsEditor } from '#components/settings/priority-settings-editor'
import { makePrioritySettings } from '#components/task/priority-settings-test-fixtures'

const settings = makePrioritySettings().map((setting) => ({
  ...setting,
  description: `Tasks in this stage are ready for ${setting.name.toLowerCase()}.`,
}))

const meta = {
  title: 'Settings/PrioritySettingsEditor',
  component: PrioritySettingsEditor,
  args: {
    settings,
    isSaving: false,
    saveError: false,
    onSave: () => {},
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-3xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PrioritySettingsEditor>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'the editor shows all priority names, descriptions, and order controls',
}

export const Saving: Story = {
  name: 'the editor disables controls while settings are being saved',
  args: { isSaving: true },
}

export const SaveError: Story = {
  name: 'the editor explains when settings could not be saved',
  args: { saveError: true },
}
