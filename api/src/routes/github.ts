import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'

import { githubProvider } from '#integrations/github/index'
import {
  callbackQuerySchema,
  handleConnectionStatus,
  handleDisconnect,
  handleGetAuthUrl,
  handleOAuthCallbackRoute,
} from '#routes/integration-handlers'

export const githubApp = new Hono()
  .get('/status', (c) => handleConnectionStatus(c, githubProvider, 'github'))
  .get('/auth-url', (c) => handleGetAuthUrl(c, githubProvider, 'github'))
  .get(
    '/oauth-callback',
    zValidator('query', callbackQuerySchema),
    async (c) => {
      const { code } = c.req.valid('query')
      return handleOAuthCallbackRoute(c, githubProvider, code, 'github')
    },
  )
  .delete('/token', (c) => handleDisconnect(c, githubProvider))
