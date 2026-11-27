import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

import { parseGithubIssueUrl } from '#integrations/github/issues'
import { setChangeEventTaskIds } from '#lib/change-events'
import { githubLinkErrorResponse } from '#routes/github-link-error'
import { taskToResponse } from '#routes/tasks/shared'
import { getTaskFieldValuesByTaskId } from '#services/task-field-values'
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
      async ({ task, link, created }) => {
        setChangeEventTaskIds(c, created ? [task.id] : [])
        const fieldValuesByTaskId = await getTaskFieldValuesByTaskId([task.id])
        return c.json(
          {
            created,
            task: taskToResponse(
              task,
              undefined,
              [link],
              [],
              fieldValuesByTaskId.get(task.id) ?? [],
            ),
          },
          created ? 201 : 200,
        )
      },
      (error) => githubLinkErrorResponse(c, error, 'tasks.from-github'),
    )
  },
)
