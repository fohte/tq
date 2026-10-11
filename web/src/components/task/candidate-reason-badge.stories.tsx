import type { Meta, StoryObj } from '@storybook/react-vite'

import { CandidateReasonBadge } from '#components/task/queue-candidate-row'

const meta = {
  title: 'Task/CandidateReasonBadge',
  component: CandidateReasonBadge,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof CandidateReasonBadge>

export default meta
type Story = StoryObj<typeof meta>

export const FollowUpToday: Story = {
  name: 'a follow-up due today uses the regular text color',
  args: { reason: { kind: 'follow-up', days: 0 } },
}

export const FollowUpOverdue: Story = {
  name: 'an overdue follow-up uses the primary text color',
  args: { reason: { kind: 'follow-up', days: 3 } },
}
