import type { Meta, StoryObj } from '@storybook/react-vite'
import { useRef } from 'react'

import type { CalendarGcalEventDetails } from '#components/calendar/calendar-gcal-event-detail'
import { makeCalendarGcalEventDetails } from '#components/calendar/calendar-gcal-event-detail-test-fixtures'
import {
  GcalEventDetailPopover,
  type GcalEventDetailPopoverProps,
} from '#components/calendar/gcal-event-detail-popover'

type StoryArgs = Pick<GcalEventDetailPopoverProps, 'event' | 'open'>

function GcalEventDetailPopoverStory({ event, open }: StoryArgs) {
  const anchor = useRef<HTMLDivElement>(null)
  return (
    <div className="p-16">
      <div
        ref={anchor}
        className="w-fit rounded border border-border bg-card px-3 py-2 font-mono text-xs"
      >
        {event.title}
      </div>
      <GcalEventDetailPopover
        anchor={anchor}
        event={event}
        open={open}
        onOpenChange={() => undefined}
      />
    </div>
  )
}

const meta = {
  title: 'Calendar/GcalEventDetailPopover',
  render: (args) => <GcalEventDetailPopoverStory {...args} />,
  args: {
    event: makeCalendarGcalEventDetails(),
    open: true,
  },
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const MeetingDetails: Story = {
  name: 'the popover shows a meeting summary with participants and links',
}

export const MinimalDetails: Story = {
  name: 'the popover shows only the title and time when optional details are missing',
  args: {
    event: makeCalendarGcalEventDetails({
      calendarDisplayName: null,
      calendarColor: null,
      responseStatus: null,
      meetingUrl: null,
      htmlLink: null,
      location: null,
      description: null,
      organizer: null,
      attendees: [],
    }) satisfies CalendarGcalEventDetails,
  },
}

export const AllDayEvent: Story = {
  name: 'the popover shows the date range for an all-day event',
  args: {
    event: makeCalendarGcalEventDetails({
      title: 'Workshop',
      start: '2031-04-09T00:00:00.000Z',
      end: '2031-04-11T00:00:00.000Z',
      allDay: true,
      meetingUrl: null,
      attendees: [],
      organizer: null,
    }),
  },
}
