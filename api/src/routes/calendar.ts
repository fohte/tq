import {
  getAuthUrl,
  getEvents,
  handleOAuthCallback,
} from '@api/services/google-calendar'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

const eventsQuerySchema = z.object({
  calendarId: z.string(),
  timeMin: z.string().datetime(),
  timeMax: z.string().datetime(),
})

const callbackQuerySchema = z.object({
  code: z.string(),
})

export const calendarApp = new Hono()
  .get('/events', zValidator('query', eventsQuerySchema), async (c) => {
    const { calendarId, timeMin, timeMax } = c.req.valid('query')

    try {
      const events = await getEvents(calendarId, timeMin, timeMax)
      return c.json(events, 200)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred'

      if (message.includes('No OAuth token found')) {
        return c.json({ error: message }, 401)
      }

      return c.json({ error: message }, 500)
    }
  })
  .get('/auth-url', (c) => {
    try {
      const url = getAuthUrl()
      return c.json({ url }, 200)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred'
      return c.json({ error: message }, 500)
    }
  })
  .get(
    '/oauth-callback',
    zValidator('query', callbackQuerySchema),
    async (c) => {
      const { code } = c.req.valid('query')

      try {
        await handleOAuthCallback(code)
        return c.json({ message: 'Authentication successful' }, 200)
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error occurred'
        return c.json({ error: message }, 400)
      }
    },
  )
