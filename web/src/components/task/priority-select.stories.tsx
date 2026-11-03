import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { PrioritySelect } from '#components/task/priority-select'
import { makePrioritySettings } from '#components/task/priority-settings-test-fixtures'

const meta = {
  title: 'Task/PrioritySelect',
  component: PrioritySelect,
  parameters: { layout: 'centered' },
  args: {
    settings: makePrioritySettings(),
    onValueChange: fn(),
  },
} satisfies Meta<typeof PrioritySelect>

export default meta
type Story = StoryObj<typeof meta>

export const SelectedPriority: Story = {
  name: 'the selector shows the configured name for a selected priority',
  args: { value: 1 },
}

export const Inbox: Story = {
  name: 'the selector shows the configured name when priority is unset',
  args: { value: null },
}
