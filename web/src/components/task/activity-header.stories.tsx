import type { Meta, StoryObj } from '@storybook/react-vite'

import { ActivityHeader } from '#components/task/activity-header'

const meta = {
  title: 'Task/ActivityHeader',
  component: ActivityHeader,
  args: {
    who: 'you',
    what: 'commented',
    when: 'just now',
  },
} satisfies Meta<typeof ActivityHeader>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'the header shows who acted, what they did, and when',
}
