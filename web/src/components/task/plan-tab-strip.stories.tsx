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

export const Default: Story = {
  name: 'the tabs show the available planning periods with none selected.',
}

export const TodaySelected: Story = {
  name: 'the tabs highlight the day queue.',
  args: {
    value: 'day',
  },
}

export const Disabled: Story = {
  name: 'the tabs are unavailable for selection.',
  args: {
    disabled: true,
  },
}
