import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { PlanTabStrip } from '#components/task/plan-tab-strip'

const meta = {
  title: 'Task/PlanTabStrip',
  component: PlanTabStrip,
  parameters: {
    layout: 'centered',
  },
  args: {
    value: '',
    onChange: fn(),
  },
} satisfies Meta<typeof PlanTabStrip>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const TodaySelected: Story = {
  args: {
    value: 'day',
  },
}

export const Disabled: Story = {
  args: {
    disabled: true,
  },
}
