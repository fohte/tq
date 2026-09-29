import type { Meta, StoryObj } from '@storybook/react-vite'

import { TaskStatusGlyph } from '#components/task/status-icon'

const meta = {
  title: 'Task/TaskStatusGlyph',
  component: TaskStatusGlyph,
  parameters: {
    layout: 'centered',
  },
  render: (args) => (
    <div className="flex items-center gap-2 text-sm">
      <TaskStatusGlyph {...args} />
      <span className="font-mono text-muted-foreground">#27</span>
      <span>Example task</span>
    </div>
  ),
} satisfies Meta<typeof TaskStatusGlyph>

export default meta
type Story = StoryObj<typeof meta>

export const Todo: Story = {
  name: 'an unfinished task has no status glyph',
  args: {
    status: 'todo',
    statusReason: null,
  },
}

export const Completed: Story = {
  name: 'a completed task has a check glyph',
  args: {
    status: 'completed',
    statusReason: 'completed',
  },
}

export const NotPlanned: Story = {
  name: 'a task closed as not planned has a cross glyph',
  args: {
    status: 'completed',
    statusReason: 'not_planned',
  },
}

export const Duplicate: Story = {
  name: 'a duplicate task has an equals glyph',
  args: {
    status: 'completed',
    statusReason: 'duplicate',
  },
}
