import type { Meta, StoryObj } from '@storybook/react-vite'

import { SlackMarkIcon } from '#components/ui/slack-mark-icon'

const meta = {
  title: 'UI/SlackMarkIcon',
  component: SlackMarkIcon,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div className="dark bg-background p-4 text-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SlackMarkIcon>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    className: 'size-6',
  },
}
