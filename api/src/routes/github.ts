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
import {
  findTaskByGithubRef,
  resolveGithubUrl,
} from '#services/task-github-links'

const resolveSchema = z.object({ url: z.string().min(1) })
const linkQuerySchema = z.object({ url: z.string().min(1) })

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
          : c.json(
              {
                linked: false,
                preview: {
                  owner: resolved.preview.owner,
                  repo: resolved.preview.repo,
                  number: resolved.preview.number,
                  kind: resolved.preview.kind,
                  url: resolved.preview.url,
                  title: resolved.preview.title,
                  body: resolved.preview.body,
                  state: resolved.preview.state,
                },
              },
              200,
            ),
      (error) => githubLinkErrorResponse(c, error, 'github.resolve'),
    )
  })
  // DB-only counterpart to /resolve: never calls the GitHub API, so an
  // untracked URL simply resolves to `{ task: null }`.
  .get('/link', zValidator('query', linkQuerySchema), async (c) => {
    const { url } = c.req.valid('query')

    const result = await parseGithubIssueUrl(url).asyncAndThen((ref) =>
      findTaskByGithubRef(ref),
    )

    return result.match(
      (found) =>
        c.json(
          {
            task: found
              ? taskToResponse(found.task, undefined, [found.link])
              : null,
          },
          200,
        ),
      (error) => githubLinkErrorResponse(c, error, 'github.link'),
    )
  })
  // The client keeps links fresh while the app is open; the hourly server
  // scheduler handles links while no client is active.
  .post('/sync', async (c) => {
    await syncAllGithubLinks(c.get('origin'))
    return c.body(null, 204)
  })
