import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { CalendarHeader } from '#components/calendar/calendar-header'

const meta = {
  title: 'Calendar/CalendarHeader',
  component: CalendarHeader,
  parameters: {
    layout: 'centered',
  },
  args: {
    currentDate: new Date(2025, 2, 7),
    onPrev: fn(),
    onNext: fn(),
    onToday: fn(),
    onViewChange: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-3xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CalendarHeader>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'the calendar header offers navigation and controls for a day',
  args: {
    activeView: 'day',
  },
}

export const WeekView: Story = {
  name: 'the calendar header shows controls for the weekly view',
  args: {
    activeView: 'week',
  },
}

export const MonthView: Story = {
  name: 'the calendar header shows controls for the monthly view',
  args: {
    activeView: 'month',
  },
}
