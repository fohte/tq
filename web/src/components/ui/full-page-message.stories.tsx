import type { Meta, StoryObj } from '@storybook/react-vite'

import { FullPageMessage } from '#components/ui/full-page-message'

const meta = {
  title: 'UI/FullPageMessage',
  component: FullPageMessage,
  decorators: [
    (Story) => (
      <div className="h-64 w-full max-w-96 border border-border">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FullPageMessage>

export default meta
type Story = StoryObj<typeof meta>

export const TaskNotFound: Story = {
  name: 'shows a full-page message when a task is missing',
  args: {
    children: 'Task not found',
  },
}

export const ProjectNotFound: Story = {
  name: 'shows a full-page message when a project is missing',
  args: {
    children: 'Project not found',
  },
}
