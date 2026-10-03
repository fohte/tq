import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { GitHubNotifyEventsPicker } from '#components/task/github-notify-events-picker'

const meta = {
  title: 'Task/GitHubNotifyEventsPicker',
  component: GitHubNotifyEventsPicker,
  parameters: {
    layout: 'centered',
  },
  args: {
    onChange: fn(),
  },
} satisfies Meta<typeof GitHubNotifyEventsPicker>

export default meta
type Story = StoryObj<typeof meta>

export const ClosedOnly: Story = {
  name: 'the trigger shows closed notifications',
  args: {
    value: ['closed'],
  },
}

export const AllEvents: Story = {
  name: 'the trigger shows all notification events',
  args: {
    value: ['closed', 'reopened', 'comments', 'other'],
  },
}

export const NotificationsOff: Story = {
  name: 'the trigger shows off when no events are selected',
  args: {
    value: [],
  },
}

export const PickerOpen: Story = {
  name: 'the open picker shows the selected notification events',
  args: {
    value: ['closed'],
    defaultOpen: true,
  },
}

export const Disabled: Story = {
  name: 'the notification picker is unavailable',
  args: {
    value: ['closed'],
    disabled: true,
  },
}
