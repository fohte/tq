import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'

import { slackProvider } from '#integrations/slack/index'
import {
  callbackQuerySchema,
  handleOAuthCallbackRoute,
} from '#routes/integration-handlers'

// Connection status/auth-url/disconnect are handled generically by
// routes/integrations.ts. This file only keeps the OAuth callback, whose URL
// path is an external contract registered with the Slack app's redirect URL.
export const slackApp = new Hono().get(
  '/oauth-callback',
  zValidator('query', callbackQuerySchema),
  async (c) => {
    const { code } = c.req.valid('query')
    return handleOAuthCallbackRoute(c, slackProvider, code, 'slack')
  },
)
