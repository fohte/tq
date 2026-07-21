import type { Meta, StoryObj } from '@storybook/react-vite'
import { GithubConnectionCard } from '@web/components/settings/github-connection-card'

const meta = {
  title: 'Settings/GithubConnectionCard',
  component: GithubConnectionCard,
  parameters: {
    layout: 'centered',
  },
  render: (args) => (
    <div className="w-96">
      <GithubConnectionCard {...args} />
    </div>
  ),
} satisfies Meta<typeof GithubConnectionCard>

export default meta
type Story = StoryObj<typeof meta>

export const Loading: Story = {
  args: {
    isLoading: true,
    connected: false,
    onDisconnect: () => {},
  },
}

export const Disconnected: Story = {
  args: {
    isLoading: false,
    connected: false,
    authUrl: 'https://github.com/login/oauth/authorize',
    onDisconnect: () => {},
  },
}

export const DisconnectedFetchingAuthUrl: Story = {
  args: {
    isLoading: false,
    connected: false,
    onDisconnect: () => {},
  },
}

export const Connected: Story = {
  args: {
    isLoading: false,
    connected: true,
    login: 'fohte',
    onDisconnect: () => {},
  },
}

export const Disconnecting: Story = {
  args: {
    isLoading: false,
    connected: true,
    login: 'fohte',
    onDisconnect: () => {},
    isDisconnecting: true,
  },
}
