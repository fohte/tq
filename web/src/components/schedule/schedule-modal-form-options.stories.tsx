import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { WeekdayToggleRow } from '#components/schedule/schedule-modal-form-options'

const meta = {
  title: 'Schedule/WeekdayToggleRow',
  component: WeekdayToggleRow,
  args: {
    daysOfWeek: [],
    toggleDay: fn(),
  },
} satisfies Meta<typeof WeekdayToggleRow>

export default meta
type Story = StoryObj<typeof meta>

export const NoDaysSelected: Story = {
  name: 'the weekday selector has no selected days',
}

export const WeekdaysSelected: Story = {
  name: 'the weekday selector marks Monday through Friday',
  args: {
    daysOfWeek: [1, 2, 3, 4, 5],
  },
}
