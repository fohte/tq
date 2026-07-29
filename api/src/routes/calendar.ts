import { captureWithFingerprint } from '@fohte/service-kit/observability'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

import { OAuthTokenMissingError, TokenRefreshError } from '#integrations/errors'
import { getEvents } from '#integrations/google-calendar/index'

const eventsQuerySchema = z.object({
  calendarId: z.string(),
  timeMin: z.iso.datetime(),
  timeMax: z.iso.datetime(),
})

export const calendarApp = new Hono().get(
  '/events',
  zValidator('query', eventsQuerySchema),
  async (c) => {
    const { calendarId, timeMin, timeMax } = c.req.valid('query')

    const result = await getEvents(calendarId, timeMin, timeMax)

    return result.match(
      (events) => c.json(events, 200),
      (error) => {
        // A missing token or a refresh token Google itself rejected (e.g.
        // revoked or expired) both mean the client must re-authenticate, so
        // both surface as 401 rather than an unexpected-error 500. Anything
        // else (network/parse/schema failure) is unexpected and must be
        // captured rather than relayed.
        if (
          error instanceof OAuthTokenMissingError ||
          (error instanceof TokenRefreshError && error.rejected)
        ) {
          return c.json({ error: error.message }, 401)
        }
        captureWithFingerprint(error, 'api.calendar.get-events-failed', {
          extras: { calendarId },
        })
        return c.json({ error: 'Internal server error' }, 500)
      },
    )
  },
)
