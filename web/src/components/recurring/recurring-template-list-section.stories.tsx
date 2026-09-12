import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'

import { RecurringTemplateListSection } from '#components/recurring/recurring-template-list-section'
import { makeRecurringTemplate } from '#components/recurring/recurring-template-test-fixtures'
import { StoryRouter } from '#storybook-config/story-router'

function RecurringTemplateListSectionStory(
  props: React.ComponentProps<typeof RecurringTemplateListSection>,
) {
  return (
    <StoryRouter
      component={() => (
        <div className="dark w-full max-w-3xl bg-background">
          <RecurringTemplateListSection {...props} />
        </div>
      )}
    />
  )
}

const meta = {
  title: 'Recurring/RecurringTemplateListSection',
  component: RecurringTemplateListSectionStory,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof RecurringTemplateListSectionStory>

export default meta
type Story = StoryObj<typeof meta>

export const Active: Story = {
  args: {
    label: 'Active',
    templates: [
      makeRecurringTemplate({
        id: 'recurring-template-1',
        title: 'Water the plants',
        enabled: true,
      }),
      makeRecurringTemplate({
        id: 'recurring-template-2',
        title: 'Pay rent',
        enabled: true,
        recurrenceRule: {
          id: 'recurrence-rule-2',
          type: 'monthly',
          interval: 1,
          daysOfWeek: null,
          dayOfMonth: 1,
        },
      }),
    ],
  },
}

export const Paused: Story = {
  args: {
    label: 'Paused',
    templates: [
      makeRecurringTemplate({
        id: 'recurring-template-3',
        title: 'Weekly team sync notes',
        enabled: false,
      }),
      makeRecurringTemplate({
        id: 'recurring-template-4',
        title: 'Review backlog',
        enabled: false,
      }),
    ],
  },
}

export const Empty: Story = {
  args: {
    label: 'Active',
    templates: [],
  },
  parameters: {
    // Renders null by design, so the screenshot is blank — VRT's
    // blank-screenshot check flags that as a likely render failure.
    screenshot: { skip: true },
  },
  play: async ({ canvas }) => {
    await expect(canvas.queryByText(/Active/)).not.toBeInTheDocument()
  },
}
