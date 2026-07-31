import { and, eq } from 'drizzle-orm'
import { okAsync, ResultAsync } from 'neverthrow'

import { db } from '#db/connection'
import { calendarSubscriptions } from '#db/schema'
import { googleCalendarProvider } from '#integrations/google-calendar/provider'
import type { CalendarListEntry } from '#integrations/types'

export type CalendarSubscriptionRow = typeof calendarSubscriptions.$inferSelect

const DEFAULT_CALENDAR_ID = 'primary'

// Never fails (a bare select), matching listAccountTokens in oauth.ts: an
// account with zero subscribed calendars is a normal, expected state (not
// an error), and getEvents() relies on that to fetch nothing for it rather
// than falling back to any implicit default.
export function listSubscribedCalendars(
  oauthTokenId: string,
): ResultAsync<CalendarSubscriptionRow[], never> {
  return ResultAsync.fromSafePromise(
    db
      .select()
      .from(calendarSubscriptions)
      .where(eq(calendarSubscriptions.oauthTokenId, oauthTokenId)),
  )
}

// Seeds a 'primary' subscription so a freshly connected account behaves the
// same as before this feature existed. onConflictDoNothing makes this a
// no-op for an account that already has subscription rows (from an earlier
// connect, or from this migration's backfill), so reconnecting an existing
// account never re-adds 'primary' after the user has deliberately
// unsubscribed from it.
export function ensureDefaultCalendarSubscription(
  oauthTokenId: string,
): ResultAsync<void, never> {
  return ResultAsync.fromSafePromise(
    db
      .insert(calendarSubscriptions)
      .values({ oauthTokenId, calendarId: DEFAULT_CALENDAR_ID })
      .onConflictDoNothing({
        target: [
          calendarSubscriptions.oauthTokenId,
          calendarSubscriptions.calendarId,
        ],
      }),
  ).map(() => undefined)
}

export interface CalendarWithSubscriptionState extends CalendarListEntry {
  subscribed: boolean
}

export function listCalendarsWithSubscriptionState(
  accessToken: string,
  oauthTokenId: string,
): ResultAsync<CalendarWithSubscriptionState[], Error> {
  return googleCalendarProvider.capabilities.calendarList
    .list(accessToken)
    .andThen((calendars) =>
      listSubscribedCalendars(oauthTokenId).map((subscriptions) => {
        const subscribedIds = new Set(
          subscriptions.map((subscription) => subscription.calendarId),
        )
        return calendars.map((calendar) => ({
          ...calendar,
          subscribed: subscribedIds.has(calendar.id),
        }))
      }),
    )
}

export interface CalendarSubscriptionUpdate {
  calendarId: string
  subscribed: boolean
}

// Subscribing looks the calendar up in the live calendarList first, so the
// stored displayName/color snapshot always comes from Google rather than
// client input, and so an unknown calendarId is rejected (resolves to null)
// instead of silently creating a subscription for a calendar that doesn't
// exist or isn't visible to this account.
export function setCalendarSubscription(
  accessToken: string,
  oauthTokenId: string,
  calendarId: string,
  subscribed: boolean,
): ResultAsync<CalendarSubscriptionUpdate | null, Error> {
  if (!subscribed) {
    return ResultAsync.fromSafePromise(
      db
        .delete(calendarSubscriptions)
        .where(
          and(
            eq(calendarSubscriptions.oauthTokenId, oauthTokenId),
            eq(calendarSubscriptions.calendarId, calendarId),
          ),
        ),
    ).map(() => ({ calendarId, subscribed: false }))
  }

  return googleCalendarProvider.capabilities.calendarList
    .list(accessToken)
    .andThen((calendars) => {
      const entry = calendars.find((calendar) => calendar.id === calendarId)
      if (entry == null) {
        return okAsync<CalendarSubscriptionUpdate | null, Error>(null)
      }

      return ResultAsync.fromSafePromise(
        db
          .insert(calendarSubscriptions)
          .values({
            oauthTokenId,
            calendarId: entry.id,
            displayName: entry.displayName,
            color: entry.color,
          })
          .onConflictDoUpdate({
            target: [
              calendarSubscriptions.oauthTokenId,
              calendarSubscriptions.calendarId,
            ],
            set: {
              displayName: entry.displayName,
              color: entry.color,
              updatedAt: new Date(),
            },
          }),
      ).map(() => ({ calendarId: entry.id, subscribed: true }))
    })
}
