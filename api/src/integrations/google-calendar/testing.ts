import { db } from '#db/connection'
import { oauthTokens } from '#db/schema'

export async function upsertGoogleCalendarToken(values: {
  accountId: string
  accountLabel?: string | null
  accessToken: string
  refreshToken: string
  expiresAt: Date
}) {
  await db
    .insert(oauthTokens)
    .values({ provider: 'google_calendar', accountLabel: null, ...values })
    .onConflictDoUpdate({
      target: [oauthTokens.provider, oauthTokens.accountId],
      set: { accountLabel: null, ...values, updatedAt: new Date() },
    })
}
