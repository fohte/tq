import type { Meta, StoryObj } from '@storybook/react-vite'

import { TaskCompletionBlockerPanelAppearance } from '#components/layout/task-completion-blocker-panel-appearance'

const meta = {
  component: TaskCompletionBlockerPanelAppearance,
  args: {
    taskNumber: 71,
    onClose: () => {},
  },
} satisfies Meta<typeof TaskCompletionBlockerPanelAppearance>

export default meta
type Story = StoryObj<typeof meta>

export const UnresolvedBlockers: Story = {
  name: 'the panel lists unresolved blockers',
  args: {
    waits: [{ id: 'wait-71', label: 'Reply from a supplier', resolved: false }],
    taskBlockers: [{ number: 24, resolved: false }],
    githubBlockers: [
      {
        key: 'sample-team/project#53',
        label: 'sample-team/project#53',
        url: 'https://github.com/sample-team/project/issues/53',
        resolved: false,
      },
    ],
  },
}

export const AllBlockersResolved: Story = {
  name: 'the panel enables completion after every blocker is resolved',
  args: {
    waits: [{ id: 'wait-71', label: 'Reply from a supplier', resolved: true }],
  },
}

export const OtherFailure: Story = {
  name: 'the panel shows an error message when the failure has no blockers',
  args: {
    message: 'The server returned an error (503).',
  },
}
