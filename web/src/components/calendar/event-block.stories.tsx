import type { Meta, StoryObj } from '@storybook/react-vite'

import type { TimeBlockEvent } from '#components/calendar/calendar-view'
import { EventBlock } from '#components/calendar/event-block'

type EventType = TimeBlockEvent['type']

function EventBlockPreview({
  type = 'manual',
  title = 'API ドキュメント作成',
  timeText = '09:00–10:00',
  parentRef,
  color,
  calendarColor,
  responseStatus,
  gcalEventType,
  redacted = false,
  allDay = false,
  widthPx = 288,
  short = false,
}: {
  type?: EventType
  title?: string
  timeText?: string
  parentRef?: string
  color?: { accent: string }
  calendarColor?: string | null
  responseStatus?: TimeBlockEvent['responseStatus']
  gcalEventType?: string
  redacted?: boolean
  allDay?: boolean
  widthPx?: number
  short?: boolean
}) {
  const arg = {
    event: {
      title,
      allDay,
      start: short ? new Date(2025, 2, 7, 11, 0) : undefined,
      end: short ? new Date(2025, 2, 7, 11, 30) : undefined,
      extendedProps: {
        type,
        parentRef,
        color,
        calendarColor,
        responseStatus,
        gcalEventType,
        redacted,
      },
    },
    timeText,
    isStart: true,
  }

  return (
    <div style={{ width: widthPx }}>
      <div className="h-20">
        {/* eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- story mock data doesn't match full EventContentArg */}
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
        'gcal-meeting',
        'gcal-solo',
        'gcal-status',
        'gcal-info',
        'completed',
        'schedule',
      ] satisfies EventType[],
    },
  },
} satisfies Meta<typeof EventBlockPreview>

export default meta
type Story = StoryObj<typeof meta>

export const Manual: Story = {
  args: {
    type: 'manual',
    title: 'API ドキュメント作成',
    timeText: '09:00–10:00',
  },
}

export const ManualWithParent: Story = {
  args: {
    type: 'manual',
    title: 'テスト追加',
    timeText: '10:30–11:30',
    parentRef: '#488 tq 作成',
  },
}

export const AutoScheduled: Story = {
  args: {
    type: 'auto',
    title: 'コードレビュー',
    timeText: '13:00–13:45',
  },
}

// 約束 (default eventType, other attendees present): today's card, unmarked.
export const GoogleCalendarMeeting: Story = {
  args: {
    type: 'gcal-meeting',
    title: 'Team standup',
    timeText: '11:00–11:30',
  },
}

export const GoogleCalendarMeetingWithColor: Story = {
  args: {
    type: 'gcal-meeting',
    title: 'Product sync',
    timeText: '18:00–18:45',
    calendarColor: '#8E24AA',
  },
}

export const GoogleCalendarMeetingSecondCalendar: Story = {
  args: {
    type: 'gcal-meeting',
    title: 'Dentist appointment',
    timeText: '16:30–17:00',
    calendarColor: '#F6BF26',
  },
}

export const GoogleCalendarMeetingNeedsAction: Story = {
  args: {
    type: 'gcal-meeting',
    title: 'Q3 planning',
    timeText: '13:00–14:00',
    responseStatus: 'needsAction',
  },
}

export const GoogleCalendarMeetingTentative: Story = {
  args: {
    type: 'gcal-meeting',
    title: 'Design review',
    timeText: '15:00–15:30',
    responseStatus: 'tentative',
  },
}

// 自分だけの予定 (default eventType, no other attendees): fill dropped, still unmarked.
export const GoogleCalendarSolo: Story = {
  args: {
    type: 'gcal-solo',
    title: '歯医者',
    timeText: '17:00–18:00',
  },
}

// 状態 (outOfOffice / focusTime): still a full card in this PR (the
// background-band treatment is a follow-up), marked with Google's own icon.
export const GoogleCalendarStatusOutOfOffice: Story = {
  args: {
    type: 'gcal-status',
    title: '退勤',
    timeText: '19:00–23:00',
    gcalEventType: 'outOfOffice',
  },
}

export const GoogleCalendarStatusFocusTime: Story = {
  args: {
    type: 'gcal-status',
    title: '集中作業',
    timeText: '13:00–15:00',
    gcalEventType: 'focusTime',
  },
}

// 情報 (isAllDay, or workingLocation): all-day row, unchanged from before.
export const GoogleCalendarInfoAllDay: Story = {
  args: {
    type: 'gcal-info',
    title: 'Company holiday',
    timeText: '',
    allDay: true,
  },
}

export const GoogleCalendarInfoWorkingLocation: Story = {
  args: {
    type: 'gcal-info',
    title: '在宅勤務',
    timeText: '',
    allDay: true,
    gcalEventType: 'workingLocation',
  },
}

// A masked event from a mismatched-context calendar always renders as the
// generic "予定あり" box, regardless of what it would otherwise classify as
// (see maskEvent in api/src/integrations/google-calendar/events.ts, which
// reports it as eventType: 'default' / hasOtherAttendees: false — i.e.
// gcal-solo — once redacted).
export const GoogleCalendarRedacted: Story = {
  args: {
    type: 'gcal-solo',
    title: '',
    timeText: '11:00–11:30',
    redacted: true,
  },
}

export const Completed: Story = {
  args: {
    type: 'completed',
    title: 'CI パイプライン構築',
    timeText: '14:00–15:00',
  },
}

export const SchedulePurple: Story = {
  args: {
    type: 'schedule',
    title: 'Sleep',
    timeText: '23:00–07:00',
    color: { accent: '#6C63FF' },
  },
}

export const ScheduleGreen: Story = {
  args: {
    type: 'schedule',
    title: 'Gym',
    timeText: '07:00–08:00',
    color: { accent: '#52B788' },
  },
}

// Reproduces a week-view column split by an overlapping event: badge and
// time both hide via container query so the title stays readable instead of
// being squeezed to 0px.
export const NarrowOverlappingColumn: Story = {
  args: {
    type: 'gcal-meeting',
    title: 'Team standup',
    timeText: '11:00–11:30',
    widthPx: 84,
    short: true,
  },
}
