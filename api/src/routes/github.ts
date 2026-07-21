import {
  disconnect,
  getAuthUrl,
  getConnectionStatus,
  handleOAuthCallback,
} from '@api/services/github'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

const callbackQuerySchema = z.object({
  code: z.string(),
})

export const githubApp = new Hono()
  .get('/status', async (c) => {
    try {
      const status = await getConnectionStatus()
      return c.json(status, 200)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred'
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
  .delete('/token', async (c) => {
    try {
      await disconnect()
      return c.json({ message: 'Disconnected' }, 200)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred'
      return c.json({ error: message }, 500)
    }
  })
