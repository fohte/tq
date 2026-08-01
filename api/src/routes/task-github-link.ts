import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { okAsync } from 'neverthrow'
import { z } from 'zod'

import { db } from '#db/connection'
import { parseGithubIssueUrl } from '#integrations/github/issues'
import { recordGithubLinked, recordGithubUnlinked } from '#lib/task-events'
import { githubLinkErrorResponse } from '#routes/github-link-error'
import { githubLinkToResponse } from '#routes/tasks/shared'
import { syncLinkFromGithub } from '#services/github-sync'
import {
  findLinkByTaskId,
  linkTaskToGithubUrl,
  unlinkTask,
} from '#services/task-github-links'

const linkSchema = z.object({ url: z.string().min(1) })

type TaskGithubLinkEnv = {
  Variables: {
    taskId: string
  }
}

export const taskGithubLinkApp = new Hono<TaskGithubLinkEnv>()
  .use('*', async (c, next) => {
    const taskId = c.req.param('taskId')
    if (taskId == null) {
      return c.json({ error: 'taskId is required' }, 400)
    }
    c.set('taskId', taskId)
    return next()
  })
  .post('/', zValidator('json', linkSchema), async (c) => {
    const taskId = c.get('taskId')
    const author = c.get('author')
    const { url } = c.req.valid('json')

    const result = await parseGithubIssueUrl(url).asyncAndThen((ref) =>
      linkTaskToGithubUrl(taskId, ref),
    )

    if (result.isOk()) {
      const link = result.value
      await recordGithubLinked(
        db,
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

    return result.match(
      (link) => c.json(githubLinkToResponse(link), 201),
      (error) => githubLinkErrorResponse(c, error, 'task-github-link.link'),
    )
  })
  .delete('/', async (c) => {
    const taskId = c.get('taskId')
    const author = c.get('author')

    const result = await unlinkTask(taskId)

    if (result.isOk()) {
      const link = result.value
      await recordGithubUnlinked(
        db,
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

    return result.match(
      () => c.body(null, 204),
      (error) => githubLinkErrorResponse(c, error, 'task-github-link.unlink'),
    )
  })
  // Triggered by the web client when it opens this task's detail view, for
  // an immediate single-task refresh instead of waiting for the next
  // whole-account sync (POST /api/github/sync). A no-op (204) when the task
  // isn't linked.
  .post('/sync', async (c) => {
    const taskId = c.get('taskId')

    const result = await findLinkByTaskId(taskId).andThen((link) =>
      link ? syncLinkFromGithub(link) : okAsync(undefined),
    )

    return result.match(
      () => c.body(null, 204),
      (error) => githubLinkErrorResponse(c, error, 'task-github-link.sync'),
    )
  })
