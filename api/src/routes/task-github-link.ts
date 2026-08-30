import { captureWithFingerprint } from '@fohte/service-kit/observability'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

import { db } from '#db/connection'
import { parseGithubIssueUrl } from '#integrations/github/issues'
import { isQuietProviderError } from '#integrations/quiet-errors'
import { recordGithubUnlinked } from '#lib/task-events'
import { githubLinkErrorResponse } from '#routes/github-link-error'
import {
  findTaskByIdOrNumber,
  getGithubLinksByTaskId,
  githubLinkToResponse,
  type TaskEnv,
} from '#routes/tasks/shared'
import { syncLinkFromGithub } from '#services/github-sync'
import { linkTaskToGithubUrl, unlinkTask } from '#services/task-github-links'

const linkSchema = z.object({ url: z.string().min(1) })

export const taskGithubLinkApp = new Hono<TaskEnv>()
  .use('*', async (c, next) => {
    const param = c.req.param('taskId')
    if (param == null) {
      return c.json({ error: 'taskId is required' }, 400)
    }

    const task = await findTaskByIdOrNumber(param)
    if (!task) {
      return c.json({ error: 'Task not found' }, 404)
    }

    c.set('task', task)
    return next()
  })
  .post('/', zValidator('json', linkSchema), async (c) => {
    const taskId = c.get('task').id
    const author = c.get('author')
    const { url } = c.req.valid('json')

    const result = await parseGithubIssueUrl(url).asyncAndThen((ref) =>
      linkTaskToGithubUrl(taskId, ref, author),
    )

    return result.match(
      (link) => c.json(githubLinkToResponse(link), 201),
      (error) => githubLinkErrorResponse(c, error, 'task-github-link.link'),
    )
  })
  .delete('/:linkId', async (c) => {
    const taskId = c.get('task').id
    const linkId = c.req.param('linkId')
    const author = c.get('author')

    const result = await db.transaction(async (tx) => {
      const unlinkResult = await unlinkTask(tx, taskId, linkId)
      if (unlinkResult.isOk()) {
        const link = unlinkResult.value
        await recordGithubUnlinked(
          tx,
          taskId,
          {
            owner: link.owner,
            repo: link.repo,
            number: link.number,
            kind: link.kind,
          },
          author,
        )
      }
      return unlinkResult
    })

    return result.match(
      () => c.body(null, 204),
      (error) => githubLinkErrorResponse(c, error, 'task-github-link.unlink'),
    )
  })
  // Continues past a failing link and reports failures via
  // captureWithFingerprint instead of the response, so one broken link
  // doesn't stop the client from seeing the others' updates (mirrors
  // syncAllGithubLinks's runSync).
  .post('/sync', async (c) => {
    const taskId = c.get('task').id

    const links = (await getGithubLinksByTaskId([taskId])).get(taskId) ?? []
    for (const link of links) {
      const result = await syncLinkFromGithub(link)
      if (result.isErr() && !isQuietProviderError(result.error)) {
        captureWithFingerprint(
          result.error,
          'api.task-github-link.sync-link-failed',
          { extras: { linkId: link.id } },
        )
      }
    }

    return c.body(null, 204)
  })
