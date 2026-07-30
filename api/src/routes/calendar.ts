import { captureWithFingerprint } from '@fohte/service-kit/observability'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

import { OAuthTokenMissingError } from '#integrations/errors'
import {
  getEvents,
  googleCalendarProvider,
  partitionAccountEvents,
} from '#integrations/google-calendar/index'
import {
  callbackQuerySchema,
  handleOAuthCallbackRoute,
} from '#routes/integration-handlers'

const eventsQuerySchema = z.object({
  timeMin: z.iso.datetime(),
  timeMax: z.iso.datetime(),
})

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
      )
    },
  )
