import { db } from '#db/connection'
import { oauthTokens } from '#db/schema'
import { ensureDefaultCalendarSubscription } from '#integrations/google-calendar/subscriptions'
import type { ExternalEvent } from '#integrations/types'
import { firstOrThrow } from '#lib/drizzle-utils'

export function makeExternalEvent(
  overrides: Partial<ExternalEvent> = {},
): ExternalEvent {
  return {
    id: 'event-1',
    summary: 'Event',
    startTime: '2026-03-22T09:00:00Z',
    endTime: '2026-03-22T09:30:00Z',
    isAllDay: false,
    source: 'google_calendar',
    accountId: 'google-sub-1',
    accountLabel: 'user@example.com',
    calendarId: 'user@example.com',
    calendarDisplayName: null,
    calendarColor: null,
    responseStatus: 'accepted',
    busy: true,
    redacted: false,
    ...overrides,
  }
}

// Mirrors what a real OAuth connect does (routes/calendar.ts calls
// ensureDefaultCalendarSubscription on a successful callback), so tests
// using this helper get the same "primary calendar subscribed" starting
// state as a real connected account instead of zero subscribed calendars.
// The seeded subscription's calendarId is `accountLabel` (matching
// ensureDefaultCalendarSubscription), not the literal 'primary'.
export async function upsertGoogleCalendarToken(values: {
  accountId: string
  accountLabel?: string | null
  accessToken: string
  refreshToken: string
  expiresAt: Date
}) {
  const row = firstOrThrow(
    await db
      .insert(oauthTokens)
      .values({ provider: 'google_calendar', accountLabel: null, ...values })
      .onConflictDoUpdate({
        target: [oauthTokens.provider, oauthTokens.accountId],
        set: { accountLabel: null, ...values, updatedAt: new Date() },
      })
      .returning({ id: oauthTokens.id }),
  )

  return ensureDefaultCalendarSubscription(
    row.id,
    values.accountLabel ?? null,
  ).then(() => undefined)
}
