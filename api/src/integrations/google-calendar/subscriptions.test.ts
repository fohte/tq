import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { db } from '#db/connection'
import { calendarSubscriptions, oauthTokens } from '#db/schema'
import {
  ensureDefaultCalendarSubscription,
  listCalendarsWithSubscriptionState,
  setCalendarSubscription,
} from '#integrations/google-calendar/subscriptions'
import { assertDefined, setupTestDb } from '#testing'

setupTestDb()

async function insertBareToken(accountId: string) {
  const [token] = await db
    .insert(oauthTokens)
    .values({
      provider: 'google_calendar',
      accountId,
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })
    .returning({ id: oauthTokens.id })
  assertDefined(token)
  return token.id
}

// Replaces the surrogate ids/timestamps with fixed placeholders and sorts by
// calendarId, since listSubscribedCalendars makes no promise about row
// order, so a calendar_subscriptions row set can still be asserted with a
// single toEqual.
function normalizeSubscriptions(
  rows: (typeof calendarSubscriptions.$inferSelect)[],
) {
  return rows
    .map((row) => ({
      ...row,
      id: 'ID',
      oauthTokenId: 'TOKEN_ID',
      createdAt: 'DATE',
      updatedAt: 'DATE',
    }))
    .sort((a, b) => a.calendarId.localeCompare(b.calendarId))
}

async function selectSubscriptions(oauthTokenId: string) {
  return db
    .select()
    .from(calendarSubscriptions)
    .where(eq(calendarSubscriptions.oauthTokenId, oauthTokenId))
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ensureDefaultCalendarSubscription', () => {
  it("seeds a 'primary' subscription when the account has none", async () => {
    const oauthTokenId = await insertBareToken('google-sub-1')

    await ensureDefaultCalendarSubscription(oauthTokenId)

    expect(
      normalizeSubscriptions(await selectSubscriptions(oauthTokenId)),
    ).toEqual([
      {
        id: 'ID',
        oauthTokenId: 'TOKEN_ID',
        calendarId: 'primary',
        displayName: null,
        color: null,
        createdAt: 'DATE',
        updatedAt: 'DATE',
      },
    ])
  })

  it("is a no-op that leaves an existing 'primary' subscription's stored display name and color untouched", async () => {
    const oauthTokenId = await insertBareToken('google-sub-1')
    await db.insert(calendarSubscriptions).values({
      oauthTokenId,
      calendarId: 'primary',
      displayName: 'user@example.com',
      color: '#123456',
    })

    await ensureDefaultCalendarSubscription(oauthTokenId)

    expect(
      normalizeSubscriptions(await selectSubscriptions(oauthTokenId)),
    ).toEqual([
      {
        id: 'ID',
        oauthTokenId: 'TOKEN_ID',
        calendarId: 'primary',
        displayName: 'user@example.com',
        color: '#123456',
        createdAt: 'DATE',
        updatedAt: 'DATE',
      },
    ])
  })
})

describe('listCalendarsWithSubscriptionState', () => {
  it("merges the live calendar list with this account's subscription state", async () => {
    const oauthTokenId = await insertBareToken('google-sub-1')
    await db.insert(calendarSubscriptions).values({
      oauthTokenId,
      calendarId: 'primary',
      displayName: 'user@example.com',
      color: '#111111',
    })

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: [
            {
              id: 'primary',
              summary: 'user@example.com',
              primary: true,
              backgroundColor: '#111111',
            },
            {
              id: 'work@example.com',
              summary: 'Work',
              backgroundColor: '#ff0000',
            },
          ],
        }),
        { status: 200 },
      ),
    )

    const result = (
      await listCalendarsWithSubscriptionState('access-token', oauthTokenId)
    )._unsafeUnwrap()

    expect(result).toEqual([
      {
        id: 'primary',
        displayName: 'user@example.com',
        color: '#111111',
        primary: true,
        subscribed: true,
      },
      {
        id: 'work@example.com',
        displayName: 'Work',
        color: '#ff0000',
        primary: false,
        subscribed: false,
      },
    ])
  })
})

describe('setCalendarSubscription', () => {
  it("subscribing persists the live calendar's display name and color", async () => {
    const oauthTokenId = await insertBareToken('google-sub-1')

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: [
            {
              id: 'work@example.com',
              summary: 'Work',
              backgroundColor: '#ff0000',
            },
          ],
        }),
        { status: 200 },
      ),
    )

    const update = (
      await setCalendarSubscription(
        'access-token',
        oauthTokenId,
        'work@example.com',
        true,
      )
    )._unsafeUnwrap()

    expect(update).toEqual({ calendarId: 'work@example.com', subscribed: true })
    expect(
      normalizeSubscriptions(await selectSubscriptions(oauthTokenId)),
    ).toEqual([
      {
        id: 'ID',
        oauthTokenId: 'TOKEN_ID',
        calendarId: 'work@example.com',
        displayName: 'Work',
        color: '#ff0000',
        createdAt: 'DATE',
        updatedAt: 'DATE',
      },
    ])
  })

  it('subscribing to a calendarId absent from the live calendarList resolves to null and creates no row', async () => {
    const oauthTokenId = await insertBareToken('google-sub-1')

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [] }), { status: 200 }),
    )

    const update = (
      await setCalendarSubscription(
        'access-token',
        oauthTokenId,
        'unknown@example.com',
        true,
      )
    )._unsafeUnwrap()

    expect(update).toBeNull()
    expect(await selectSubscriptions(oauthTokenId)).toEqual([])
  })

  it('unsubscribing deletes the row', async () => {
    const oauthTokenId = await insertBareToken('google-sub-1')
    await db
      .insert(calendarSubscriptions)
      .values({ oauthTokenId, calendarId: 'primary' })

    const update = (
      await setCalendarSubscription(
        'access-token',
        oauthTokenId,
        'primary',
        false,
      )
    )._unsafeUnwrap()

    expect(update).toEqual({ calendarId: 'primary', subscribed: false })
    expect(await selectSubscriptions(oauthTokenId)).toEqual([])
  })

  it('unsubscribing is idempotent when no subscription row exists', async () => {
    const oauthTokenId = await insertBareToken('google-sub-1')

    const update = (
      await setCalendarSubscription(
        'access-token',
        oauthTokenId,
        'primary',
        false,
      )
    )._unsafeUnwrap()

    expect(update).toEqual({ calendarId: 'primary', subscribed: false })
  })
})
