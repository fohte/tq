import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { TaskWaitEntryAppearance } from '#components/task/task-wait-entry-appearance'
import { makeTaskWait } from '#components/task/task-wait-test-fixtures'

const meta = {
  title: 'Task/TaskWaitEntryAppearance',
  component: TaskWaitEntryAppearance,
  args: {
    wait: makeTaskWait(),
    followUpDate: '2099-10-13',
    disabled: false,
    onFollowUpDateChange: fn(),
    onFollowUpDateBlur: fn(),
    onResolve: fn(),
    onAcknowledge: fn(),
    onRemove: fn(),
    onBodyChange: fn(),
    onExitEditMode: fn(),
  },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof TaskWaitEntryAppearance>

export default meta
type Story = StoryObj<typeof meta>

export const Waiting: Story = {
  name: 'an active wait shows its follow-up date and resolve action',
  args: { layout: 'standalone' },
}

export const ReplyReceived: Story = {
  name: 'a GitHub reply highlights the wait until it is acknowledged',
  args: {
    wait: makeTaskWait({
      label: 'Review feedback',
      body: 'Review received',
      githubLinkId: 'github-blocker-1',
      resolvedAt: '2099-10-12T00:00:00.000Z',
      acknowledgedAt: null,
    }),
    layout: 'github-blocker',
  },
}

export const Acknowledged: Story = {
  name: 'an acknowledged wait appears resolved',
  args: {
    wait: makeTaskWait({
      label: 'Review feedback',
      body: 'Review received',
      resolvedAt: '2099-10-12T00:00:00.000Z',
      acknowledgedAt: '2099-10-12T00:00:00.000Z',
    }),
    layout: 'standalone',
  },
}
