import { Button } from '@fohte/ui/button'
import { Popover, PopoverContent } from '@fohte/ui/popover'
import { ExternalLink, MapPin, Users, Video } from 'lucide-react'
import type { RefObject } from 'react'

import type { CalendarGcalEventDetails } from '#components/calendar/calendar-gcal-event-detail'

const RESPONSE_LABELS = {
  needsAction: 'Needs action',
  declined: 'Declined',
  tentative: 'Tentative',
  accepted: 'Accepted',
} as const

const RESPONSE_ORDER = [
  'accepted',
  'tentative',
  'needsAction',
  'declined',
] as const

const BLOCK_TAGS = new Set([
  'ADDRESS',
  'ARTICLE',
  'BLOCKQUOTE',
  'DIV',
  'LI',
  'P',
  'SECTION',
  'TR',
])

function htmlDescriptionToText(description: string): string {
  const document = new DOMParser().parseFromString(description, 'text/html')

  const readNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ''
    if (!(node instanceof Element)) return ''

    const content = Array.from(node.childNodes, readNode).join('')
    if (node.tagName === 'BR') return '\n'
    return BLOCK_TAGS.has(node.tagName) ? `${content}\n` : content
  }

  return readNode(document.body)
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function renderDescription(description: string) {
  const text = htmlDescriptionToText(description)
  const parts = text.split(/(https?:\/\/[^\s<>"']+)/g)

  return parts.map((part, index) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={index}
        href={part}
        target="_blank"
        rel="noreferrer"
        className="break-all text-primary underline underline-offset-2"
      >
        {part}
      </a>
    ) : (
      part
    ),
  )
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function parseDateOnly(value: string): Date {
  const [year, month, day] = value
    .slice(0, 10)
    .split('-')
    .map((part) => Number(part))
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1)
}

function formatEventDateTime(event: CalendarGcalEventDetails): string {
  if (event.allDay) {
    const start = parseDateOnly(event.start)
    const inclusiveEnd = parseDateOnly(event.end)
    inclusiveEnd.setDate(inclusiveEnd.getDate() - 1)
    return start.toDateString() === inclusiveEnd.toDateString()
      ? formatDate(start)
      : `${formatDate(start)} – ${formatDate(inclusiveEnd)}`
  }

  const start = new Date(event.start)
  const end = new Date(event.end)
  const sameDate = start.toDateString() === end.toDateString()

  if (sameDate) {
    return `${formatDate(start)} · ${formatTime(start)}–${formatTime(end)}`
  }

  return `${formatDate(start)} ${formatTime(start)} – ${formatDate(end)} ${formatTime(end)}`
}

function getPersonIdentity(
  person:
    | {
        email: string | null
        displayName: string | null
      }
    | null
    | undefined,
): string | null {
  const displayName = person?.displayName?.trim()
  if (displayName != null && displayName !== '') return displayName

  const email = person?.email?.trim()
  return email == null || email === '' ? null : email
}

function getAttendeeIdentity(
  attendee: CalendarGcalEventDetails['attendees'][number],
): string | null {
  return getPersonIdentity(attendee)
}

function getOrganizerIdentity(event: CalendarGcalEventDetails): string | null {
  return (
    getPersonIdentity(event.organizer) ??
    getPersonIdentity(event.attendees.find((attendee) => attendee.isOrganizer))
  )
}

function getAttendanceSummary(event: CalendarGcalEventDetails): string | null {
  const counts = new Map<string, number>()
  for (const attendee of event.attendees) {
    if (attendee.responseStatus == null) continue
    counts.set(
      attendee.responseStatus,
      (counts.get(attendee.responseStatus) ?? 0) + 1,
    )
  }

  const entries = RESPONSE_ORDER.flatMap((status) => {
    const count = counts.get(status)
    return count == null
      ? []
      : [`${String(count)} ${RESPONSE_LABELS[status].toLowerCase()}`]
  })

  return entries.length === 0 ? null : entries.join(' · ')
}

export interface GcalEventDetailPopoverProps {
  anchor: RefObject<Element | null>
  event: CalendarGcalEventDetails
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GcalEventDetailPopover({
  anchor,
  event,
  open,
  onOpenChange,
}: GcalEventDetailPopoverProps) {
  const attendees = event.attendees
    .map((attendee) => ({ attendee, identity: getAttendeeIdentity(attendee) }))
    .filter(
      (
        entry,
      ): entry is {
        attendee: (typeof event.attendees)[number]
        identity: string
      } => entry.identity != null,
    )
  const organizer = getOrganizerIdentity(event)
  const attendanceSummary = getAttendanceSummary(event)
  const description = event.description?.trim()
  const location = event.location?.trim()
  const calendarDisplayName = event.calendarDisplayName?.trim()
  const meetingUrl = event.meetingUrl?.trim()
  const htmlLink = event.htmlLink?.trim()

  return (
    <Popover anchor={anchor} open={open} onOpenChange={onOpenChange}>
      <PopoverContent
        initialFocus={false}
        padding="md"
        aria-label="Calendar event details"
        data-calendar-event-details
        className="max-h-(--available-height) w-96 max-w-(--available-width) overflow-y-auto"
      >
        <div className="space-y-3 text-xs">
          <header className="space-y-1">
            <h2 className="break-words text-sm font-semibold text-foreground">
              {event.title}
            </h2>
            <p className="text-muted-foreground">
              {formatEventDateTime(event)}
            </p>
          </header>

          {calendarDisplayName != null && calendarDisplayName !== '' && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: event.calendarColor ?? undefined }}
              />
              {calendarDisplayName}
            </p>
          )}

          {location != null && location !== '' && (
            <p className="flex items-start gap-2 break-words">
              <MapPin
                aria-hidden="true"
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
              />
              <span>{location}</span>
            </p>
          )}

          {event.responseStatus != null && (
            <p className="text-muted-foreground">
              Your response:{' '}
              <span className="text-foreground">
                {RESPONSE_LABELS[event.responseStatus]}
              </span>
            </p>
          )}

          {event.attendees.length > 0 && (
            <section className="space-y-1.5" data-calendar-event-attendees>
              <h3 className="flex items-center gap-2 font-medium">
                <Users
                  aria-hidden="true"
                  className="h-3.5 w-3.5 text-muted-foreground"
                />
                Attendees ({String(event.attendees.length)})
              </h3>
              {attendanceSummary != null && (
                <p className="pl-5 text-muted-foreground">
                  {attendanceSummary}
                </p>
              )}
              {attendees.length > 0 && (
                <ul className="space-y-0.5 pl-5 text-muted-foreground">
                  {attendees.map(({ attendee, identity }) => (
                    <li
                      key={attendee.email ?? identity}
                      className="break-words"
                    >
                      {identity}
                    </li>
                  ))}
                </ul>
              )}
              {organizer != null && (
                <p className="pl-5 text-muted-foreground">
                  Organizer:{' '}
                  <span className="text-foreground">{organizer}</span>
                </p>
              )}
            </section>
          )}

          {event.attendees.length === 0 && organizer != null && (
            <p className="text-muted-foreground">
              Organizer: <span className="text-foreground">{organizer}</span>
            </p>
          )}

          {description != null && description !== '' && (
            <p
              className="break-words whitespace-pre-wrap text-muted-foreground"
              data-calendar-event-description
            >
              {renderDescription(description)}
            </p>
          )}

          {((meetingUrl != null && meetingUrl !== '') ||
            (htmlLink != null && htmlLink !== '')) && (
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2">
              {meetingUrl != null && meetingUrl !== '' && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() =>
                    window.open(meetingUrl, '_blank', 'noopener,noreferrer')
                  }
                >
                  <Video aria-hidden="true" />
                  Join meeting
                </Button>
              )}
              {htmlLink != null && htmlLink !== '' && (
                <a
                  href={htmlLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary underline underline-offset-2"
                >
                  <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                  Open in Google Calendar
                </a>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
