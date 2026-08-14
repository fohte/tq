import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { TaskListToolbar } from '#components/task/task-list-toolbar'

const meta = {
  title: 'Task/TaskListToolbar',
  component: TaskListToolbar,
  parameters: {
    layout: 'centered',
  },
  args: {
    onCreateFromGithub: fn(),
    onCreateNew: fn(),
  },
} satisfies Meta<typeof TaskListToolbar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
