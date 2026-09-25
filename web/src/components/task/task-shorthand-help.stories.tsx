import type { Meta, StoryObj } from '@storybook/react-vite'

import { TaskShorthandHelp } from '#components/task/task-shorthand-help'

const meta = {
  title: 'Task/TaskShorthandHelp',
  component: TaskShorthandHelp,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-96 bg-background p-4">
        <div className="flex justify-end">
          <Story />
        </div>
      </div>
    ),
  ],
} satisfies Meta<typeof TaskShorthandHelp>

export default meta
type Story = StoryObj<typeof meta>

export const Closed: Story = {
  name: 'the shorthand guide stays collapsed beside the title field',
  args: {
    defaultOpen: false,
  },
}

export const Open: Story = {
  name: 'the guide lists task-title shorthand syntax',
  args: {
    defaultOpen: true,
  },
}
