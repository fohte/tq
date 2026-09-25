import type { Meta, StoryObj } from '@storybook/react-vite'

import { ListAreaMessage } from '#components/ui/list-area-message'

const meta = {
  title: 'UI/ListAreaMessage',
  component: ListAreaMessage,
  decorators: [
    (Story) => (
      <div className="w-full max-w-96 border border-border">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ListAreaMessage>

export default meta
type Story = StoryObj<typeof meta>

export const Loading: Story = {
  name: 'shows a loading message in a task list',
  args: {
    children: 'Loading...',
  },
}

export const Empty: Story = {
  name: 'shows an empty state message in a task list',
  args: {
    children: 'No tasks yet',
  },
}
