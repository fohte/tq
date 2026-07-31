import type { Meta, StoryObj } from '@storybook/react-vite'
import { Calendar } from 'lucide-react'

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

const githubIcon = <GithubMarkIcon className="size-6 text-foreground" />
const googleCalendarIcon = <Calendar className="size-6 text-foreground" />

export const NotConfigured: Story = {
  args: {
    icon: githubIcon,
    displayName: 'GitHub',
    accounts: [],
    canConnect: false,
    configured: false,
    onDisconnectAccount: () => {},
  },
}

export const Disconnected: Story = {
  args: {
    icon: githubIcon,
    displayName: 'GitHub',
    accounts: [],
    canConnect: true,
    configured: true,
    authUrl: 'https://github.com/login/oauth/authorize',
    onDisconnectAccount: () => {},
  },
}

export const DisconnectedFetchingAuthUrl: Story = {
  args: {
    icon: githubIcon,
    displayName: 'GitHub',
    accounts: [],
    canConnect: true,
    configured: true,
    onDisconnectAccount: () => {},
  },
}

export const SingleAccountConnected: Story = {
  args: {
    icon: githubIcon,
    displayName: 'GitHub',
    accounts: [{ id: 'token-1', label: 'fohte' }],
    canConnect: false,
    configured: true,
    onDisconnectAccount: () => {},
  },
}

export const MultiAccountOneConnected: Story = {
  args: {
    icon: googleCalendarIcon,
    displayName: 'Google Calendar',
    accounts: [{ id: 'token-1', label: 'fohte@example.com' }],
    canConnect: true,
    configured: true,
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    onDisconnectAccount: () => {},
  },
}

export const MultiAccountTwoConnected: Story = {
  args: {
    icon: googleCalendarIcon,
    displayName: 'Google Calendar',
    accounts: [
      { id: 'token-1', label: 'fohte@example.com' },
      { id: 'token-2', label: 'fohte.work@example.com' },
    ],
    canConnect: true,
    configured: true,
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    onDisconnectAccount: () => {},
  },
}

export const Disconnecting: Story = {
  args: {
    ...MultiAccountTwoConnected.args,
    disconnectingAccountId: 'token-1',
  },
}
