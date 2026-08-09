import type { Meta, StoryObj } from '@storybook/react-vite'

import { SlackAuthorSummary } from '#components/task/slack-author-summary'

// An inline data URI keeps the screenshot deterministic — an external URL
// (e.g. placehold.co) made VRT captures flaky depending on whether the
// request settled before the screenshot was taken.
const AVATAR_URL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Crect width='64' height='64' fill='%2394a3b8'/%3E%3C/svg%3E"

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
    authorAvatarUrl: AVATAR_URL,
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
