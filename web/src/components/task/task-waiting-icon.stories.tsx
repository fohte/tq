import type { Meta, StoryObj } from '@storybook/react-vite'

import { TaskWaitingIcon } from '#components/task/task-waiting-icon'

const meta = {
  title: 'Task/TaskWaitingIcon',
  component: TaskWaitingIcon,
  parameters: {
    layout: 'centered',
  },
  render: () => (
    <div className="flex items-center gap-2 text-sm">
      <TaskWaitingIcon />
      <span className="font-mono text-muted-foreground">#27</span>
      <span>Example task</span>
    </div>
  ),
} satisfies Meta<typeof TaskWaitingIcon>

export default meta
type Story = StoryObj<typeof meta>

export const WaitingForReply: Story = {
  name: 'the icon marks a task waiting for a reply',
  args: {},
}
