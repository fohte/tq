import type { Meta, StoryObj } from '@storybook/react-vite'

import { PushNotificationsPanel } from '#components/settings/push-notifications-panel'

const meta = {
  title: 'Settings/PushNotificationsPanel',
  component: PushNotificationsPanel,
  args: {
    status: 'disabled',
    context: 'personal',
    pending: null,
    testSent: false,
    error: null,
    onEnable: () => {},
    onDisable: () => {},
    onTest: () => {},
  },
  render: (args) => (
    <div className="w-full max-w-3xl">
      <PushNotificationsPanel {...args} />
    </div>
  ),
} satisfies Meta<typeof PushNotificationsPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Loading: Story = {
  args: { status: 'loading' },
}

export const Disabled: Story = {
  args: { status: 'disabled' },
}

export const Enabling: Story = {
  args: { status: 'disabled', pending: 'enable' },
}

export const Enabled: Story = {
  args: { status: 'enabled' },
}

export const EnabledForWork: Story = {
  args: { status: 'enabled', context: 'work' },
}

export const Disabling: Story = {
  args: { status: 'enabled', pending: 'disable' },
}

export const SendingTest: Story = {
  args: { status: 'enabled', pending: 'test' },
}

export const TestSent: Story = {
  args: { status: 'enabled', testSent: true },
}

export const Unsupported: Story = {
  args: { status: 'unsupported' },
}

export const Denied: Story = {
  args: { status: 'denied' },
}

export const WithError: Story = {
  args: { status: 'disabled', error: 'Push notifications are not configured' },
}
