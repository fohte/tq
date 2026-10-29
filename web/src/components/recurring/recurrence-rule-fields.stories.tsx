import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { RecurrenceRuleFields } from '#components/recurring/recurrence-rule-fields'

const meta = {
  title: 'Recurring/RecurrenceRuleFields',
  component: RecurrenceRuleFields,
  decorators: [
    (Story) => (
      <div className="dark min-h-64 bg-background p-6">
        <div className="flex w-72 flex-col gap-3 rounded-md border bg-popover p-3 text-popover-foreground">
          <Story />
        </div>
      </div>
    ),
  ],
  args: {
    type: 'daily',
    onTypeChange: fn(),
    intervalInput: '1',
    intervalValue: 1,
    onIntervalInputChange: fn(),
    daysOfWeek: [],
    onToggleDay: fn(),
    dayOfMonth: '',
    onDayOfMonthChange: fn(),
  },
} satisfies Meta<typeof RecurrenceRuleFields>

export default meta
type Story = StoryObj<typeof meta>

export const Daily: Story = {
  name: 'the fields show a daily interval',
}

export const Weekly: Story = {
  name: 'the fields show selected weekdays for a weekly rule',
  args: { type: 'weekly', daysOfWeek: [0, 3] },
}

export const Monthly: Story = {
  name: 'the fields show a selected day for a monthly rule',
  args: { type: 'monthly', dayOfMonth: '15' },
}
