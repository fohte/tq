import type { Meta, StoryObj } from '@storybook/react-vite'

import { RecurringTemplateListRow } from '#components/recurring/recurring-template-list-row'
import { makeRecurringTemplate } from '#components/recurring/recurring-template-test-fixtures'
import { StoryRouter } from '#storybook-config/story-router'

function RecurringTemplateListRowStory(
  props: React.ComponentProps<typeof RecurringTemplateListRow>,
) {
  return (
    <StoryRouter
      component={() => (
        <div className="dark w-full max-w-3xl bg-background">
          <RecurringTemplateListRow {...props} />
        </div>
      )}
    />
  )
}

const meta = {
  title: 'Recurring/RecurringTemplateListRow',
  component: RecurringTemplateListRowStory,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof RecurringTemplateListRowStory>

export default meta
type Story = StoryObj<typeof meta>

export const ActiveWeekly: Story = {
  args: {
    template: makeRecurringTemplate({
      title: 'Water the plants',
      enabled: true,
      recurrenceRule: {
        id: 'recurrence-rule-1',
        type: 'weekly',
        interval: 1,
        daysOfWeek: [0, 3],
        dayOfMonth: null,
      },
      anchorDate: '2026-03-20',
      lastGeneratedDate: '2026-03-18',
    }),
  },
}

export const ActiveMonthly: Story = {
  args: {
    template: makeRecurringTemplate({
      title: 'Pay rent',
      enabled: true,
      recurrenceRule: {
        id: 'recurrence-rule-2',
        type: 'monthly',
        interval: 1,
        daysOfWeek: null,
        dayOfMonth: 1,
      },
      anchorDate: '2026-03-01',
      lastGeneratedDate: '2026-03-01',
    }),
  },
}

export const Paused: Story = {
  args: {
    template: makeRecurringTemplate({
      title: 'Weekly team sync notes',
      enabled: false,
      recurrenceRule: {
        id: 'recurrence-rule-3',
        type: 'weekly',
        interval: 1,
        daysOfWeek: [1],
        dayOfMonth: null,
      },
    }),
  },
}
