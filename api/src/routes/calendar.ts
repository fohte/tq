import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

const eventsQuerySchema = z.object({
  calendarId: z.string(),
  timeMin: z.iso.datetime(),
  timeMax: z.iso.datetime(),
})

export const calendarApp = new Hono()
  .get('/events', zValidator('query', eventsQuerySchema), (c) => {
    // TODO: implement Google Calendar events retrieval
    return c.json([], 200)
  })
  .get('/auth-url', (c) => {
    // TODO: implement OAuth auth URL generation
    return c.json({ message: 'not implemented' }, 501)
  })
  .get('/oauth-callback', (c) => {
    // TODO: implement OAuth callback handling
    void c.req.query('code')
    return c.json({ message: 'not implemented' }, 501)
  })
