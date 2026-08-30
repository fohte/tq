import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

import { githubProvider } from '#integrations/github/index'
import { parseGithubIssueUrl } from '#integrations/github/issues'
import { githubLinkErrorResponse } from '#routes/github-link-error'
import {
  callbackQuerySchema,
  handleOAuthCallbackRoute,
} from '#routes/integration-handlers'
import { taskToResponse } from '#routes/tasks/shared'
import { syncAllGithubLinks } from '#services/github-sync'
import { resolveGithubUrl } from '#services/task-github-links'

const resolveSchema = z.object({ url: z.string().min(1) })

// Connection status/auth-url/disconnect are handled generically by
// routes/integrations.ts. This file only keeps the OAuth callback (its URL
// path is an external contract registered with the GitHub OAuth App) and
// GitHub-specific operations (resolve/sync).
export const githubApp = new Hono()
  .get(
    '/oauth-callback',
    zValidator('query', callbackQuerySchema),
    async (c) => {
      const { code } = c.req.valid('query')
      return handleOAuthCallbackRoute(c, githubProvider, code, 'github')
    },
  )
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
                // Only the one link this URL resolved to, not the task's
                // full link set — this endpoint answers "what does this
                // GitHub resource point to", not "list this task's links".
                task: taskToResponse(resolved.existingTask, undefined, [
                  resolved.existingLink,
                ]),
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
