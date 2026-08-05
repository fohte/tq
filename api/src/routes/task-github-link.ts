import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { okAsync } from 'neverthrow'
import { z } from 'zod'

import { db } from '#db/connection'
import { parseGithubIssueUrl } from '#integrations/github/issues'
import { recordGithubUnlinked } from '#lib/task-events'
import { githubLinkErrorResponse } from '#routes/github-link-error'
import {
  findTaskByIdOrNumber,
  githubLinkToResponse,
  type TaskEnv,
} from '#routes/tasks/shared'
import { syncLinkFromGithub } from '#services/github-sync'
import {
  findLinkByTaskId,
  linkTaskToGithubUrl,
  unlinkTask,
} from '#services/task-github-links'

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
  .delete('/', async (c) => {
    const taskId = c.get('task').id
    const author = c.get('author')

    const result = await db.transaction(async (tx) => {
      const unlinkResult = await unlinkTask(tx, taskId)
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
  // Triggered by the web client when it opens this task's detail view, for
  // an immediate single-task refresh instead of waiting for the next
  // whole-account sync (POST /api/github/sync). A no-op (204) when the task
  // exists but isn't linked; a nonexistent task 404s via the middleware
  // above.
  .post('/sync', async (c) => {
    const taskId = c.get('task').id

    const result = await findLinkByTaskId(taskId).andThen((link) =>
      link ? syncLinkFromGithub(link) : okAsync(undefined),
    )

    return result.match(
      () => c.body(null, 204),
      (error) => githubLinkErrorResponse(c, error, 'task-github-link.sync'),
    )
  })
