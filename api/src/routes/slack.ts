import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

import { slackProvider } from '#integrations/slack/index'
import { resolveSlackPermalink } from '#integrations/slack/messages'
import { parseSlackPermalink } from '#integrations/slack/permalink'
import {
  callbackQuerySchema,
  handleOAuthCallbackRoute,
} from '#routes/integration-handlers'
import { slackLinkErrorResponse } from '#routes/slack-link-error'

const resolveSchema = z.object({ url: z.string().min(1) })

// Connection status/auth-url/disconnect are handled generically by
// routes/integrations.ts. This file only keeps the OAuth callback (its URL
// path is an external contract registered with the Slack app's redirect
// URL) and Slack-specific operations (resolve).
export const slackApp = new Hono()
  .get(
    '/oauth-callback',
    zValidator('query', callbackQuerySchema),
    async (c) => {
      const { code } = c.req.valid('query')
      return handleOAuthCallbackRoute(c, slackProvider, code, 'slack')
    },
  )
  .post('/resolve', zValidator('json', resolveSchema), async (c) => {
    const { url } = c.req.valid('json')

    const result = await parseSlackPermalink(url).asyncAndThen((ref) =>
      resolveSlackPermalink(ref),
    )

    return result.match(
      (preview) => c.json({ preview }, 200),
      (error) => slackLinkErrorResponse(c, error, 'slack.resolve'),
    )
  })
