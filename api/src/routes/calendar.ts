import { captureWithFingerprint } from '@fohte/service-kit/observability'
import { zValidator } from '@hono/zod-validator'
import type { Context } from 'hono'
import { Hono } from 'hono'
import { z } from 'zod'

import { OAuthTokenMissingError, TokenRefreshError } from '#integrations/errors'
import {
  ensureDefaultCalendarSubscription,
  getEvents,
  googleCalendarProvider,
  listCalendarsWithSubscriptionState,
  partitionAccountEvents,
  setCalendarSubscription,
} from '#integrations/google-calendar/index'
import { ensureValidAccessToken, getAccountToken } from '#integrations/oauth'
import {
  callbackQuerySchema,
  handleOAuthCallbackRoute,
} from '#routes/integration-handlers'

const eventsQuerySchema = z.object({
  timeMin: z.iso.datetime(),
  timeMax: z.iso.datetime(),
})

const calendarSubscriptionBodySchema = z.object({
  subscribed: z.boolean(),
})

// Maps a calendars-endpoint failure to an HTTP response: an auth rejection
// is a normal, recoverable OAuth outcome (the client should prompt
// re-connecting), so it gets its own 401 instead of falling into the
// generic 500 + Sentry capture path.
function calendarsErrorResponse(
  c: Context,
  error: Error,
  fingerprint: string,
  extras: Record<string, string>,
) {
  if (error instanceof TokenRefreshError && error.rejected) {
    return c.json({ error: 'Google Calendar authentication is required' }, 401)
  }
  captureWithFingerprint(error, fingerprint, { extras })
  return c.json({ error: 'Internal server error' }, 500)
}

// Connection status/auth-url/disconnect are handled generically by
// routes/integrations.ts. This file only keeps /events and the OAuth
// callback (its URL path is an external contract registered with the
// Google Cloud OAuth client).
export const calendarApp = new Hono()
  .get('/events', zValidator('query', eventsQuerySchema), async (c) => {
    const { timeMin, timeMax } = c.req.valid('query')

    const accounts = await getEvents(timeMin, timeMax)

    if (accounts.length === 0) {
      return c.json({ error: new OAuthTokenMissingError().message }, 401)
    }

    const { events, successCount, authRejectedCount } = partitionAccountEvents(
      accounts,
      (accountId, error) => {
        captureWithFingerprint(
          error,
          'api.calendar.get-events-account-failed',
          { extras: { accountId } },
        )
      },
    )

    // Only a total wipeout (zero successes) can produce a non-200 response,
    // so a live account's events are never hidden just because another
    // connected account's token was revoked. `successCount` (accounts that
    // successfully fetched, even with zero events) is tracked separately
    // from `events.length`, because an account with a genuinely empty
    // calendar for the day is a normal success, not a failure.
    if (successCount > 0) {
      return c.json(events, 200)
    }

    if (authRejectedCount === accounts.length) {
      return c.json(
        { error: 'Google Calendar authentication is required' },
        401,
      )
    }

    return c.json({ error: 'Internal server error' }, 500)
  })
  .get(
    '/oauth-callback',
    zValidator('query', callbackQuerySchema),
    async (c) => {
      const { code } = c.req.valid('query')
      return handleOAuthCallbackRoute(
        c,
        googleCalendarProvider,
        code,
        'calendar',
        ({ oauthTokenId }) =>
          Promise.resolve(ensureDefaultCalendarSubscription(oauthTokenId)).then(
            () => undefined,
          ),
      )
    },
  )
  .get('/accounts/:accountId/calendars', async (c) => {
    const accountId = c.req.param('accountId')

    const token = await getAccountToken(
      googleCalendarProvider,
      accountId,
    ).match(
      (row) => row,
      () => null,
    )
    if (token == null) {
      return c.json({ error: 'Not found' }, 404)
    }

    const result = await ensureValidAccessToken(
      googleCalendarProvider,
      token,
    ).andThen((accessToken) =>
      listCalendarsWithSubscriptionState(accessToken, token.id),
    )

    return result.match(
      (calendars) => c.json(calendars, 200),
      (error) =>
        calendarsErrorResponse(c, error, 'api.calendar.list-calendars-failed', {
          accountId,
        }),
    )
  })
  .put(
    '/accounts/:accountId/calendars/:calendarId/subscription',
    zValidator('json', calendarSubscriptionBodySchema),
    async (c) => {
      const accountId = c.req.param('accountId')
      const calendarId = c.req.param('calendarId')
      const { subscribed } = c.req.valid('json')

      const token = await getAccountToken(
        googleCalendarProvider,
        accountId,
      ).match(
        (row) => row,
        () => null,
      )
      if (token == null) {
        return c.json({ error: 'Not found' }, 404)
      }

      const result = await ensureValidAccessToken(
        googleCalendarProvider,
        token,
      ).andThen((accessToken) =>
        setCalendarSubscription(accessToken, token.id, calendarId, subscribed),
      )

      return result.match(
        (update) =>
          update == null
            ? c.json({ error: 'Not found' }, 404)
            : c.json(update, 200),
        (error) =>
          calendarsErrorResponse(
            c,
            error,
            'api.calendar.update-subscription-failed',
            { accountId, calendarId },
          ),
      )
    },
  )
