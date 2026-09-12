import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { TaskListToolbar } from '#components/task/task-list-toolbar'
import { StoryRouter } from '#storybook-config/story-router'

const meta = {
  title: 'Task/TaskListToolbar',
  component: TaskListToolbar,
  tags: ['desktop-only'],
  parameters: {
    layout: 'centered',
  },
  args: {
    onCreateNew: fn(),
  },
  decorators: [
    (Story) => (
      <StoryRouter paths={['/recurring']} component={() => <Story />} />
    ),
  ],
} satisfies Meta<typeof TaskListToolbar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
