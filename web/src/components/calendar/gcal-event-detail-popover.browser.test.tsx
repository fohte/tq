import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { makeCalendarGcalEventDetails } from '#components/calendar/calendar-gcal-event-detail-test-fixtures'
import { CalendarGrid } from '#components/calendar/calendar-grid'
import type { TimeBlockEvent } from '#components/calendar/calendar-view'
import {
  GcalEventDetailPopover,
  type GcalEventDetailPopoverProps,
} from '#components/calendar/gcal-event-detail-popover'
import { makeTimeBlockEvent } from '#components/calendar/time-block-event-test-fixtures'
import { formatLocalDate } from '#lib/date-range'

type DetailHarnessProps = Pick<GcalEventDetailPopoverProps, 'event'>

function DetailHarness({ event }: DetailHarnessProps) {
  const anchor = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button ref={anchor} type="button">
        Event anchor
      </button>
      <GcalEventDetailPopover
        anchor={anchor}
        event={event}
        open={true}
        onOpenChange={() => undefined}
      />
    </>
  )
}

const today = new Date()
const start = new Date(
  today.getFullYear(),
  today.getMonth(),
  today.getDate(),
  9,
)
const end = new Date(start.getTime() + 30 * 60 * 1000)
const eventDate = formatLocalDate(start)
const endDate = formatLocalDate(end)
const nextDay = new Date(start)
nextDay.setDate(nextDay.getDate() + 1)
const nextDayDate = formatLocalDate(nextDay)
const detailStart = new Date('2031-04-09T15:00:00.000Z')
const detailEnd = new Date('2031-04-09T15:30:00.000Z')

function makeCalendarEvent(
  overrides: Partial<TimeBlockEvent> = {},
): TimeBlockEvent {
  return makeTimeBlockEvent({
    id: 'gcal-event-1',
    title: 'Planning session',
    start: `${eventDate}T09:00:00`,
    end: `${endDate}T09:30:00`,
    type: 'gcal-meeting',
    gcalDetails: makeCalendarGcalEventDetails({
      start: `${eventDate}T09:00:00`,
      end: `${endDate}T09:30:00`,
    }),
    ...overrides,
  })
}

function renderCalendarEvent(
  activeView: 'day' | 'week' | 'month',
  event: TimeBlockEvent,
) {
  return render(
    <div data-testid="outside-calendar" style={{ height: '100vh' }}>
      <CalendarGrid
        events={[event]}
        activeView={activeView}
        initialDate={start}
        initialScrollTime="08:00:00"
      />
    </div>,
  )
}

function readEventOverview(popup: HTMLElement) {
  return {
    title: popup.querySelector('h2')?.textContent,
    detailRows: Array.from(popup.querySelectorAll('p')).map(
      (row) => row.textContent,
    ),
    links: Array.from(popup.querySelectorAll('a')).map((link) => ({
      text: link.textContent,
      href: link.href,
    })),
    joinButton: within(popup).getByRole('button', { name: 'Join meeting' })
      .textContent,
  }
}

function formatExpectedDate(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

function formatExpectedTime(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function roundedPixelValue(value: number | string): string {
  const pixels = typeof value === 'number' ? value : Number.parseFloat(value)
  return `${String(Number(pixels.toFixed(2)))}px`
}

function readAnchorPosition(anchor: HTMLElement | null) {
  if (anchor == null) return null

  const style = getComputedStyle(anchor)
  return {
    position: style.position,
    left: roundedPixelValue(style.left),
    top: roundedPixelValue(style.top),
    width: roundedPixelValue(style.width),
    height: roundedPixelValue(style.height),
  }
}

function readDescription(description: HTMLElement) {
  return {
    text: description.textContent,
    links: Array.from(description.querySelectorAll('a')).map((link) => ({
      text: link.textContent,
      href: link.href,
      target: link.target,
      rel: link.rel,
    })),
  }
}

function readAttendeeDetails(attendees: HTMLElement) {
  return {
    text: attendees.textContent,
    names: Array.from(attendees.querySelectorAll('li')).map(
      (attendee) => attendee.textContent,
    ),
  }
}

function readOptionalRows(popup: HTMLElement) {
  return {
    calendar: popup.querySelectorAll('.rounded-full').length,
    location: popup.querySelectorAll('svg.lucide-map-pin').length,
    response: popup.textContent.includes('Your response:'),
    attendees: popup.querySelectorAll('[data-calendar-event-attendees]').length,
    description: popup.querySelectorAll('[data-calendar-event-description]')
      .length,
    links: popup.querySelectorAll('a').length,
    joinButtons: within(popup).queryAllByRole('button', {
      name: 'Join meeting',
    }).length,
  }
}

describe('GcalEventDetailPopover', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the calendar, RSVP, location, and event links', () => {
    render(<DetailHarness event={makeCalendarGcalEventDetails()} />)
    const popup = screen.getByLabelText('Calendar event details')

    expect(readEventOverview(popup)).toEqual({
      title: 'Planning session',
      detailRows: [
        `${formatExpectedDate(detailStart)} · ${formatExpectedTime(detailStart)}–${formatExpectedTime(detailEnd)}`,
        'Project calendar',
        'North conference room',
        'Your response: Accepted',
        '1 accepted · 1 tentative',
        'Organizer: Alex Morgan',
        'Agenda and notes\nhttps://docs.example.org/agenda',
      ],
      links: [
        {
          text: 'https://docs.example.org/agenda',
          href: 'https://docs.example.org/agenda',
        },
        {
          text: 'Open in Google Calendar',
          href: 'https://calendar.example.org/event',
        },
      ],
      joinButton: 'Join meeting',
    })
  })

  it('shows the inclusive final date of a multi-day all-day event', () => {
    const startDate = new Date(2031, 3, 9)
    const inclusiveEndDate = new Date(2031, 3, 10)
    const exclusiveEndDate = new Date(2031, 3, 11)
    render(
      <DetailHarness
        event={makeCalendarGcalEventDetails({
          title: 'Workshop',
          start: formatLocalDate(startDate),
          end: formatLocalDate(exclusiveEndDate),
          allDay: true,
          calendarDisplayName: null,
          calendarColor: null,
          responseStatus: null,
          location: null,
          organizer: null,
          attendees: [],
          description: null,
          htmlLink: null,
        })}
      />,
    )

    expect(
      readEventOverview(screen.getByLabelText('Calendar event details')),
    ).toEqual({
      title: 'Workshop',
      detailRows: [
        `${formatExpectedDate(startDate)} – ${formatExpectedDate(inclusiveEndDate)}`,
      ],
      links: [],
      joinButton: 'Join meeting',
    })
  })

  it('shows dates on both sides of a timed event that crosses midnight', () => {
    const startDate = new Date(2031, 3, 9, 23, 30)
    const endDate = new Date(2031, 3, 10, 0, 30)
    render(
      <DetailHarness
        event={makeCalendarGcalEventDetails({
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          calendarDisplayName: null,
          calendarColor: null,
          responseStatus: null,
          location: null,
          organizer: null,
          attendees: [],
          description: null,
          htmlLink: null,
        })}
      />,
    )

    expect(
      readEventOverview(screen.getByLabelText('Calendar event details')),
    ).toEqual({
      title: 'Planning session',
      detailRows: [
        `${formatExpectedDate(startDate)} ${formatExpectedTime(startDate)} – ${formatExpectedDate(endDate)} ${formatExpectedTime(endDate)}`,
      ],
      links: [],
      joinButton: 'Join meeting',
    })
  })

  it('opens the meeting URL when Join meeting is clicked', async () => {
    const openWindow = vi.spyOn(window, 'open').mockReturnValue(null)
    render(<DetailHarness event={makeCalendarGcalEventDetails()} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Join meeting' }))

    expect(openWindow.mock.calls).toEqual([
      ['https://meet.example.org/room', '_blank', 'noopener,noreferrer'],
    ])
  })

  it('renders HTML descriptions as text and links only their URLs', () => {
    render(
      <DetailHarness
        event={makeCalendarGcalEventDetails({
          description:
            '<p>Agenda <strong>draft</strong></p><p>https://docs.example.org/agenda</p><script>run()</script>',
        })}
      />,
    )

    const description = screen.getByText(
      (_content, element) =>
        element?.hasAttribute('data-calendar-event-description') === true,
    )
    expect(readDescription(description)).toEqual({
      text: 'Agenda draft\nhttps://docs.example.org/agenda\nrun()',
      links: [
        {
          text: 'https://docs.example.org/agenda',
          href: 'https://docs.example.org/agenda',
          target: '_blank',
          rel: 'noreferrer',
        },
      ],
    })
  })

  it('shows attendee counts, response breakdown, identities, and organizer', () => {
    render(<DetailHarness event={makeCalendarGcalEventDetails()} />)
    const attendees = screen.getByText(
      (_content, element) =>
        element?.hasAttribute('data-calendar-event-attendees') === true,
    )

    expect(readAttendeeDetails(attendees)).toEqual({
      text: 'Attendees (2)1 accepted · 1 tentativeAlex MorganJordan LeeOrganizer: Alex Morgan',
      names: ['Alex Morgan', 'Jordan Lee'],
    })
  })

  it('uses attendee email when names are empty and organizer details are missing', () => {
    render(
      <DetailHarness
        event={makeCalendarGcalEventDetails({
          organizer: { email: null, displayName: '' },
          attendees: [
            {
              email: 'organizer@example.org',
              displayName: '',
              responseStatus: 'accepted',
              isSelf: false,
              isOrganizer: true,
            },
            {
              email: 'participant@example.org',
              displayName: null,
              responseStatus: null,
              isSelf: false,
              isOrganizer: false,
            },
          ],
        })}
      />,
    )
    const attendees = screen.getByText(
      (_content, element) =>
        element?.hasAttribute('data-calendar-event-attendees') === true,
    )

    expect(readAttendeeDetails(attendees)).toEqual({
      text: 'Attendees (2)1 acceptedorganizer@example.orgparticipant@example.orgOrganizer: organizer@example.org',
      names: ['organizer@example.org', 'participant@example.org'],
    })
  })

  it('omits optional rows when event details are unavailable', () => {
    render(
      <DetailHarness
        event={makeCalendarGcalEventDetails({
          calendarDisplayName: null,
          calendarColor: null,
          responseStatus: null,
          meetingUrl: null,
          htmlLink: null,
          location: null,
          description: null,
          organizer: null,
          attendees: [],
        })}
      />,
    )

    const popup = screen.getByLabelText('Calendar event details')
    expect(readOptionalRows(popup)).toEqual({
      calendar: 0,
      location: 0,
      response: false,
      attendees: 0,
      description: 0,
      links: 0,
      joinButtons: 0,
    })
  })
})

describe('Google Calendar event clicks', () => {
  it.each(['day', 'week', 'month'] as const)(
    'opens details from the %s view',
    async (activeView) => {
      const { container } = renderCalendarEvent(activeView, makeCalendarEvent())
      const user = userEvent.setup()

      await user.click(await within(container).findByText('Planning session'))

      expect(
        await screen.findByRole('heading', { name: 'Planning session' }),
      ).toBeTruthy()
    },
  )

  it.each(['gcal-solo', 'gcal-status', 'gcal-info'] as const)(
    'opens details when a %s event is clicked',
    async (type) => {
      const event =
        type === 'gcal-info'
          ? makeCalendarEvent({
              type,
              allDay: true,
              start: eventDate,
              end: nextDayDate,
              gcalDetails: makeCalendarGcalEventDetails({
                title: 'Planning session',
                start: eventDate,
                end: nextDayDate,
                allDay: true,
              }),
            })
          : makeCalendarEvent({ type })
      const { container } = renderCalendarEvent('day', event)
      const user = userEvent.setup()

      await user.click(await within(container).findByText('Planning session'))

      expect(
        await screen.findByRole('heading', { name: 'Planning session' }),
      ).toBeTruthy()
    },
  )

  it('closes details when Escape is pressed', async () => {
    const { container } = renderCalendarEvent('day', makeCalendarEvent())
    const user = userEvent.setup()
    await user.click(await within(container).findByText('Planning session'))
    await screen.findByRole('heading', { name: 'Planning session' })

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(document.querySelector('[data-calendar-event-details]')).toBeNull()
    })
  })

  it('closes details when the user clicks outside the popover', async () => {
    const { container } = renderCalendarEvent('day', makeCalendarEvent())
    const user = userEvent.setup()
    await user.click(await within(container).findByText('Planning session'))
    await screen.findByRole('heading', { name: 'Planning session' })

    await user.click(screen.getByTestId('outside-calendar'))

    await waitFor(() => {
      expect(document.querySelector('[data-calendar-event-details]')).toBeNull()
    })
  })

  it('keeps the popover anchored after the calendar event is refreshed', async () => {
    const { container, rerender } = renderCalendarEvent(
      'day',
      makeCalendarEvent(),
    )
    const user = userEvent.setup()
    const eventText = await within(container).findByText('Planning session')
    const eventElement = eventText.closest<HTMLElement>('.fc-event')
    if (eventElement == null) throw new Error('Calendar event was not rendered')
    const rect = eventElement.getBoundingClientRect()

    await user.click(eventText)
    await screen.findByRole('heading', { name: 'Planning session' })

    rerender(
      <div data-testid="outside-calendar" style={{ height: '100vh' }}>
        <CalendarGrid
          events={[
            makeCalendarEvent({
              title: 'Updated planning session',
              gcalDetails: makeCalendarGcalEventDetails({
                title: 'Updated planning session',
              }),
            }),
          ]}
          activeView="day"
          initialDate={start}
          initialScrollTime="08:00:00"
        />
      </div>,
    )
    await within(container).findByText('Updated planning session')

    expect(
      readAnchorPosition(
        document.querySelector<HTMLElement>('[data-gcal-event-popover-anchor]'),
      ),
    ).toEqual({
      position: 'fixed',
      left: roundedPixelValue(rect.left),
      top: roundedPixelValue(rect.top),
      width: roundedPixelValue(rect.width),
      height: roundedPixelValue(rect.height),
    })
  })

  it('does not open details for a redacted event', async () => {
    const event = makeCalendarEvent({ redacted: true })
    const { container } = renderCalendarEvent('day', event)
    const user = userEvent.setup()

    await user.click(await within(container).findByText('予定あり'))

    expect(document.querySelector('[data-calendar-event-details]')).toBeNull()
  })
})
