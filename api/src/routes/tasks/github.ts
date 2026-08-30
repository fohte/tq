import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

import { parseGithubIssueUrl } from '#integrations/github/issues'
import { githubLinkErrorResponse } from '#routes/github-link-error'
import { taskToResponse } from '#routes/tasks/shared'
import { createTaskFromGithubUrl } from '#services/task-github-links'

const fromGithubSchema = z.object({ url: z.string().min(1) })

export const tasksGithubApp = new Hono().post(
  '/from-github',
  zValidator('json', fromGithubSchema),
  async (c) => {
    const { url } = c.req.valid('json')

    const result = await parseGithubIssueUrl(url).asyncAndThen((ref) =>
      createTaskFromGithubUrl(ref),
    )

    return result.match(
      ({ task, link, created }) =>
        c.json(
          { created, task: taskToResponse(task, undefined, [link]) },
          created ? 201 : 200,
        ),
      (error) => githubLinkErrorResponse(c, error, 'tasks.from-github'),
    )
  },
)
