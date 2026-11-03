import type { Meta, StoryObj } from '@storybook/react-vite'

import { PriorityBadge } from '#components/task/priority-badge'

const meta = {
  title: 'Task/PriorityBadge',
  component: PriorityBadge,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof PriorityBadge>

export default meta
type Story = StoryObj<typeof meta>

export const ConfiguredName: Story = {
  name: 'the badge shows a configured priority name',
  args: { name: 'Next' },
}
