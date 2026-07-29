import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

import type { taskGithubLinks } from '#db/schema'
import { parseGithubIssueUrl } from '#integrations/github/issues'
import { githubLinkErrorResponse } from '#routes/github-link-error'
import { linkTaskToGithubUrl, unlinkTask } from '#services/task-github-links'

const linkSchema = z.object({ url: z.string().min(1) })

export function githubLinkToResponse(
  link: typeof taskGithubLinks.$inferSelect,
) {
  return {
    id: link.id,
    owner: link.owner,
    repo: link.repo,
    number: link.number,
    kind: link.kind,
    url: link.url,
    state: link.state,
    title: link.title,
    lastSyncedAt: link.lastSyncedAt.toISOString(),
  }
}

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
    const { url } = c.req.valid('json')

    const result = await parseGithubIssueUrl(url).asyncAndThen((ref) =>
      linkTaskToGithubUrl(taskId, ref),
    )

    return result.match(
      (link) => c.json(githubLinkToResponse(link), 201),
      (error) => githubLinkErrorResponse(c, error, 'task-github-link.link'),
    )
  })
  .delete('/', async (c) => {
    const taskId = c.get('taskId')

    const result = await unlinkTask(taskId)

    return result.match(
      () => c.body(null, 204),
      (error) => githubLinkErrorResponse(c, error, 'task-github-link.unlink'),
    )
  })
