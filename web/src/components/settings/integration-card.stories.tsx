import type { Meta, StoryObj } from '@storybook/react-vite'

import { IntegrationCard } from '#components/settings/integration-card'
import { GithubMarkIcon } from '#components/ui/github-mark-icon'

const meta = {
  title: 'Settings/IntegrationCard',
  component: IntegrationCard,
  parameters: {
    layout: 'centered',
  },
  render: (args) => (
    <div className="w-96">
      <IntegrationCard {...args} />
    </div>
  ),
} satisfies Meta<typeof IntegrationCard>

export default meta
type Story = StoryObj<typeof meta>

const icon = <GithubMarkIcon className="size-6 text-foreground" />

export const ConnectedWithLogin: Story = {
  args: {
    icon,
    displayName: 'GitHub',
    connected: true,
    login: 'fohte',
    configured: true,
    onDisconnect: () => {},
  },
}

export const ConnectedWithoutLogin: Story = {
  args: {
    icon,
    displayName: 'Google Calendar',
    connected: true,
    configured: true,
    onDisconnect: () => {},
  },
}

export const DisconnectedWithAuthUrl: Story = {
  args: {
    icon,
    displayName: 'GitHub',
    connected: false,
    configured: true,
    authUrl: 'https://github.com/login/oauth/authorize',
    onDisconnect: () => {},
  },
}

export const DisconnectedFetchingAuthUrl: Story = {
  args: {
    icon,
    displayName: 'GitHub',
    connected: false,
    configured: true,
    onDisconnect: () => {},
  },
}

export const NotConfigured: Story = {
  args: {
    icon,
    displayName: 'GitHub',
    connected: false,
    configured: false,
    onDisconnect: () => {},
  },
}

export const Disconnecting: Story = {
  args: {
    icon,
    displayName: 'GitHub',
    connected: true,
    login: 'fohte',
    configured: true,
    onDisconnect: () => {},
    isDisconnecting: true,
  },
}
