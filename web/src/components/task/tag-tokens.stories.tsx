import type { Meta, StoryObj } from '@storybook/react-vite'

import { TagTokens } from '#components/task/task-row-shared'

// Clicking a tag navigates to /tasks via useNavigate, and the Storybook
// preview already wraps every story in a router (see .storybook/preview.tsx),
// so no extra provider setup is needed here.
function TagTokensDemo({ labels }: { labels: string[] }) {
  return (
    <div className="w-80 border border-border p-3">
      <TagTokens labels={labels} />
    </div>
  )
}

const meta = {
  title: 'Task/TagTokens',
  component: TagTokensDemo,
} satisfies Meta<typeof TagTokensDemo>

export default meta
type Story = StoryObj<typeof meta>

export const SingleLabel: Story = {
  name: 'a task displays one label token',
  args: {
    labels: ['dev:tq'],
  },
}

export const MultipleLabels: Story = {
  name: 'a task displays several label tokens',
  args: {
    labels: ['dev:tq', 'chore', 'urgent'],
  },
}
