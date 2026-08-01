import type { Meta, StoryObj } from '@storybook/react-vite'

import { SlackAuthorSummary } from '#components/task/slack-author-summary'

const meta = {
  title: 'Task/SlackAuthorSummary',
  component: SlackAuthorSummary,
  parameters: {
    layout: 'centered',
  },
  render: (args) => (
    <div className="flex items-center gap-2">
      <SlackAuthorSummary {...args} />
    </div>
  ),
} satisfies Meta<typeof SlackAuthorSummary>

export default meta
type Story = StoryObj<typeof meta>

export const WithAvatar: Story = {
  args: {
    authorName: 'Hayato Kawai',
    authorAvatarUrl: 'https://placehold.co/64x64',
    channelName: 'general',
  },
}

export const WithoutAvatar: Story = {
  args: {
    authorName: 'CI Bot',
    authorAvatarUrl: null,
    channelName: 'ci-alerts',
  },
}
