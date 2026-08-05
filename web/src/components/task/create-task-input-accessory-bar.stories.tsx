import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { CreateTaskInputAccessoryBar } from '#components/task/create-task-input-accessory-bar'

const meta = {
  title: 'Task/CreateTaskInputAccessoryBar',
  component: CreateTaskInputAccessoryBar,
  parameters: {
    layout: 'centered',
  },
  args: {
    onTriggerTap: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CreateTaskInputAccessoryBar>

export default meta
type Story = StoryObj<typeof meta>

export const AllTriggers: Story = {
  args: {
    triggers: ['@', '>', '#', '%', '^'],
  },
}

export const WithoutParentTrigger: Story = {
  args: {
    triggers: ['@', '>', '#', '%'],
  },
}
