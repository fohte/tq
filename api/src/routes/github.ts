import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

import { githubProvider } from '#integrations/github/index'
import { parseGithubIssueUrl } from '#integrations/github/issues'
import { githubLinkErrorResponse } from '#routes/github-link-error'
import {
  callbackQuerySchema,
  handleConnectionStatus,
  handleDisconnect,
  handleGetAuthUrl,
  handleOAuthCallbackRoute,
} from '#routes/integration-handlers'
import { taskToResponse } from '#routes/tasks/shared'
import { syncAllGithubLinks } from '#services/github-sync'
import { resolveGithubUrl } from '#services/task-github-links'

const resolveSchema = z.object({ url: z.string().min(1) })

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
  .post('/resolve', zValidator('json', resolveSchema), async (c) => {
    const { url } = c.req.valid('json')

    const result = await parseGithubIssueUrl(url).asyncAndThen((ref) =>
      resolveGithubUrl(ref),
    )

    return result.match(
      (resolved) =>
        'existingTask' in resolved
          ? c.json(
              {
                linked: true,
                task: taskToResponse(
                  resolved.existingTask,
                  undefined,
                  resolved.existingLink,
                ),
              },
              200,
            )
          : c.json({ linked: false, preview: resolved.preview }, 200),
      (error) => githubLinkErrorResponse(c, error, 'github.resolve'),
    )
  })
  // Triggered by the web client while it's open and focused (mount, window
  // focus regain, and a periodic interval in between) — there is no
  // server-side background schedule. Syncs every linked task in one pass,
  // so `lastSyncedAt` also acts as a catch-up cursor for whatever changed on
  // GitHub while the client was closed.
  .post('/sync', async (c) => {
    await syncAllGithubLinks()
    return c.body(null, 204)
  })
