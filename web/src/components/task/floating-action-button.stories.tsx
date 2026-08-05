import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { FloatingActionButton } from '#components/task/floating-action-button'

const meta = {
  title: 'Task/FloatingActionButton',
  component: FloatingActionButton,
  parameters: {
    layout: 'centered',
  },
  args: {
    onClick: fn(),
  },
  decorators: [
    (Story) => (
      <div className="relative h-40 w-40">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FloatingActionButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
