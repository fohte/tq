import {
  getAuthUrl,
  getEvents,
  GoogleCalendarConfigError,
  handleOAuthCallback,
  OAuthTokenMissingError,
} from '@api/services/google-calendar'
import { captureWithFingerprint } from '@fohte/service-kit/observability'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

const eventsQuerySchema = z.object({
  calendarId: z.string(),
  timeMin: z.iso.datetime(),
  timeMax: z.iso.datetime(),
})

const callbackQuerySchema = z.object({
  code: z.string(),
})

export const calendarApp = new Hono()
  .get('/events', zValidator('query', eventsQuerySchema), async (c) => {
    const { calendarId, timeMin, timeMax } = c.req.valid('query')

    const result = await getEvents(calendarId, timeMin, timeMax)

    return result.match(
      (events) => c.json(events, 200),
      (error) => {
        if (error instanceof OAuthTokenMissingError) {
          return c.json({ error: error.message }, 401)
        }
        captureWithFingerprint(error, 'api.calendar.get-events-failed', {
          extras: { calendarId },
        })
        return c.json({ error: 'Internal server error' }, 500)
      },
    )
  })
  .get('/auth-url', (c) => {
    return getAuthUrl().match(
      (url) => c.json({ url }, 200),
      (error) => {
        captureWithFingerprint(error, 'api.calendar.get-auth-url-failed')
        return c.json({ error: 'Internal server error' }, 500)
      },
    )
  })
  .get(
    '/oauth-callback',
    zValidator('query', callbackQuerySchema),
    async (c) => {
      const { code } = c.req.valid('query')

      const result = await handleOAuthCallback(code)

      return result.match(
        () => c.json({ message: 'Authentication successful' }, 200),
        (error) => {
          // A config error means the server itself is misconfigured, so its
          // message (which names the missing env vars) must not reach the
          // client. A rejected code is a normal OAuth-flow outcome, so
          // relaying the provider's own rejection reason back is fine.
          if (error instanceof GoogleCalendarConfigError) {
            captureWithFingerprint(
              error,
              'api.calendar.oauth-callback-config-error',
            )
            return c.json({ error: 'Internal server error' }, 500)
          }
          return c.json({ error: error.message }, 400)
        },
      )
    },
  )
