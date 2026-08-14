import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

import { db } from '#db/connection'
import { recurrenceRules, taskGithubLinks } from '#db/schema'
import { APP_DOMAIN } from '#env'
import { extractAppResourceRefs } from '#lib/app-url'
import {
  findTaskByIdOrNumber,
  getLabelNamesByTaskId,
  taskToResponse,
} from '#routes/tasks/shared'

const resolveUrlSchema = z.object({ url: z.string().min(1) })

// Mirrors POST /api/github/resolve: the web editor's task-url provider only
// matches a URL's path shape, so this endpoint is the sole authority on
// whether it actually points at this tq instance (APP_DOMAIN) before
// resolving it to a task.
export const tasksResolveUrlApp = new Hono().post(
  '/resolve-url',
  zValidator('json', resolveUrlSchema),
  async (c) => {
    const { url } = c.req.valid('json')
    const [ref] = extractAppResourceRefs(url, APP_DOMAIN, 'tasks')
    if (ref == null) {
      return c.json({ error: 'Not a task URL' }, 404)
    }

    const task = await findTaskByIdOrNumber(
      ref.kind === 'number' ? String(ref.value) : ref.value,
    )
    if (task == null) {
      return c.json({ error: 'Task not found' }, 404)
    }

    const [rule, githubLink, labelsByTaskId] = await Promise.all([
      task.recurrenceRuleId != null
        ? db.query.recurrenceRules.findFirst({
            where: eq(recurrenceRules.id, task.recurrenceRuleId),
          })
        : Promise.resolve(null),
      db.query.taskGithubLinks.findFirst({
        where: eq(taskGithubLinks.taskId, task.id),
      }),
      getLabelNamesByTaskId([task.id]),
    ])

    return c.json(
      taskToResponse(task, rule, githubLink, labelsByTaskId.get(task.id) ?? []),
      200,
    )
  },
)
