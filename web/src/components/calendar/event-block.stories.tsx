import type { Meta, StoryObj } from '@storybook/react-vite'
import type { TimeBlockEvent } from '@web/components/calendar/calendar-view'
import { EventBlock } from '@web/components/calendar/event-block'

type EventType = TimeBlockEvent['type']

function EventBlockPreview({
  type = 'manual',
  title = 'Design review',
  timeText = '9:00 – 10:00',
}: {
  type?: EventType
  title?: string
  timeText?: string
}) {
  // Build a minimal EventContentArg-like object for the component
  const arg = {
    event: {
      title,
      extendedProps: { type },
    },
    timeText,
  }

  return (
    <div className="w-64">
      <div className="h-20">
        <EventBlock {...(arg as unknown as Parameters<typeof EventBlock>[0])} />
      </div>
    </div>
  )
}

const meta = {
  title: 'Calendar/EventBlock',
  component: EventBlockPreview,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    type: {
      control: 'select',
      options: [
        'manual',
        'auto',
        'gcal',
        'completed',
        'schedule',
      ] satisfies EventType[],
    },
  },
} satisfies Meta<typeof EventBlockPreview>

export default meta
type Story = StoryObj<typeof meta>

export const Manual: Story = {
  args: { type: 'manual', title: 'Design review', timeText: '9:00 – 10:00' },
}

export const AutoScheduled: Story = {
  args: {
    type: 'auto',
    title: 'Write API docs',
    timeText: '10:30 – 11:30',
  },
}

export const GoogleCalendar: Story = {
  args: { type: 'gcal', title: 'Team standup', timeText: '11:00 – 11:30' },
}

export const Completed: Story = {
  args: {
    type: 'completed',
    title: 'Set up CI pipeline',
    timeText: '14:00 – 15:00',
  },
}

export const Schedule: Story = {
  args: { type: 'schedule', title: 'Daily review', timeText: '17:00 – 17:30' },
}
