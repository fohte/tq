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
  name: 'shows an empty progress bar',
  args: {
    percent: 0,
  },
}

export const Partial: Story = {
  name: 'shows a progress bar filled to 39 percent',
  args: {
    percent: 39,
  },
}

export const Full: Story = {
  name: 'shows a fully filled progress bar',
  args: {
    percent: 100,
  },
}

export const DimFill: Story = {
  name: 'shows a partially filled progress bar with a muted fill',
  args: {
    percent: 39,
    fillClassName: 'bg-muted-foreground',
  },
}
