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
  name: 'the notification settings show a loading state',
  args: { status: 'loading' },
}

export const Disabled: Story = {
  name: 'push notifications are disabled and can be enabled',
  args: { status: 'disabled' },
}

export const Enabling: Story = {
  name: 'push notifications are being enabled',
  args: { status: 'disabled', pending: 'enable' },
}

export const Enabled: Story = {
  name: 'push notifications are enabled',
  args: { status: 'enabled' },
}

export const EnabledForWork: Story = {
  name: 'push notifications are enabled for the work context',
  args: { status: 'enabled', context: 'work' },
}

export const Disabling: Story = {
  name: 'push notifications are being disabled',
  args: { status: 'enabled', pending: 'disable' },
}

export const SendingTest: Story = {
  name: 'a test notification is being sent',
  args: { status: 'enabled', pending: 'test' },
}

export const TestSent: Story = {
  name: 'the notification settings confirm that a test was sent',
  args: { status: 'enabled', testSent: true },
}

export const Unsupported: Story = {
  name: 'the browser does not support push notifications',
  args: { status: 'unsupported' },
}

export const Denied: Story = {
  name: 'browser permission for push notifications was denied',
  args: { status: 'denied' },
}

export const WithError: Story = {
  name: 'the notification settings show a configuration error',
  args: { status: 'disabled', error: 'Push notifications are not configured' },
}
