import { db } from '#db/connection'
import { oauthTokens } from '#db/schema'
import { ensureDefaultCalendarSubscription } from '#integrations/google-calendar/subscriptions'
import { firstOrThrow } from '#lib/drizzle-utils'

// Mirrors what a real OAuth connect does (routes/calendar.ts calls
// ensureDefaultCalendarSubscription on a successful callback), so tests
// using this helper get the same "primary calendar subscribed" starting
// state as a real connected account instead of zero subscribed calendars.
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

  return ensureDefaultCalendarSubscription(row.id).then(() => undefined)
}
