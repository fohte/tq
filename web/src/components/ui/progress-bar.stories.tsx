import type { Meta, StoryObj } from '@storybook/react-vite'

import { ProgressBar } from '#components/ui/progress-bar'

const meta = {
  title: 'UI/ProgressBar',
  component: ProgressBar,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-64">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProgressBar>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  args: {
    percent: 0,
  },
}

export const Partial: Story = {
  args: {
    percent: 39,
  },
}

export const Full: Story = {
  args: {
    percent: 100,
  },
}

export const DimFill: Story = {
  args: {
    percent: 39,
    fillClassName: 'bg-muted-foreground',
  },
}
