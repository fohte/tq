import { zValidator } from '@hono/zod-validator'
import { and, count, eq, inArray, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

import { db } from '#db/connection'
import { projects, tasks } from '#db/schema'
import { APP_DOMAIN } from '#env'
import { extractAppResourceRefs } from '#lib/app-url'
import {
  createProjectSchema,
  listProjectsQuerySchema,
  updateProjectSchema,
} from '#schemas/project'

const resolveUrlSchema = z.object({ url: z.string().min(1) })

function projectToResponse(project: typeof projects.$inferSelect) {
  return {
    id: project.id,
    title: project.title,
    description: project.description,
    status: project.status,
    startDate: project.startDate,
    targetDate: project.targetDate,
    color: project.color,
    sortOrder: project.sortOrder,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  }
}

function taskStatsToSummary(total: number, completed: number) {
  return {
    completionRate: total > 0 ? completed / total : 0,
    taskCount: { total, completed },
  }
}

async function findProjectWithStats(id: string) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  })
  if (!project) return null

  const [taskStats] = await db
    .select({
      total: count(),
      completed: count(sql`CASE WHEN ${tasks.status} = 'completed' THEN 1 END`),
    })
    .from(tasks)
    .where(eq(tasks.projectId, id))

  return {
    ...projectToResponse(project),
    ...taskStatsToSummary(taskStats?.total ?? 0, taskStats?.completed ?? 0),
  }
}

export const projectsApp = new Hono()
  .post('/', zValidator('json', createProjectSchema), async (c) => {
    const input = c.req.valid('json')

    const [project] = await db
      .insert(projects)
      .values({
        title: input.title,
        description: input.description ?? null,
        status: input.status ?? 'active',
        startDate: input.startDate ?? null,
        targetDate: input.targetDate ?? null,
        color: input.color ?? null,
        sortOrder: input.sortOrder ?? 0,
      })
      .returning()

    if (!project) {
      return c.json({ error: 'Failed to create project' }, 500)
    }

    return c.json(projectToResponse(project), 201)
  })
  .get('/', zValidator('query', listProjectsQuerySchema), async (c) => {
    const query = c.req.valid('query')
    const conditions = []

    if (query.status) {
      conditions.push(eq(projects.status, query.status))
    }

    const result = await db
      .select()
      .from(projects)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(projects.sortOrder, projects.createdAt)

    const projectIds = result.map((project) => project.id)
    const taskStats =
      projectIds.length > 0
        ? await db
            .select({
              projectId: tasks.projectId,
              total: count(),
              completed: count(
                sql`CASE WHEN ${tasks.status} = 'completed' THEN 1 END`,
              ),
            })
            .from(tasks)
            .where(inArray(tasks.projectId, projectIds))
            .groupBy(tasks.projectId)
        : []

    const statsByProjectId = new Map(
      taskStats.map((stats) => [stats.projectId, stats]),
    )

    return c.json(
      result.map((project) => {
        const stats = statsByProjectId.get(project.id)
        return {
          ...projectToResponse(project),
          ...taskStatsToSummary(stats?.total ?? 0, stats?.completed ?? 0),
        }
      }),
      200,
    )
  })
  .get('/:id', async (c) => {
    const result = await findProjectWithStats(c.req.param('id'))
    if (!result) {
      return c.json({ error: 'Project not found' }, 404)
    }

    return c.json(result, 200)
  })
  // Mirrors POST /api/github/resolve: the web editor's project-url provider
  // only matches a URL's path shape, so this endpoint is the sole authority
  // on whether it actually points at this tq instance (APP_DOMAIN) before
  // resolving it to a project.
  .post('/resolve-url', zValidator('json', resolveUrlSchema), async (c) => {
    const { url } = c.req.valid('json')
    const [ref] = extractAppResourceRefs(url, APP_DOMAIN, 'projects')
    // Projects have no `number` column (see `AppResourceRef`), so a
    // numeric-looking ref can never resolve to one.
    if (ref == null || ref.kind !== 'id') {
      return c.json({ error: 'Not a project URL' }, 404)
    }

    const result = await findProjectWithStats(ref.value)
    if (!result) {
      return c.json({ error: 'Project not found' }, 404)
    }

    return c.json(result, 200)
  })
  .patch('/:id', zValidator('json', updateProjectSchema), async (c) => {
    const id = c.req.param('id')

    const existing = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    })
    if (!existing) {
      return c.json({ error: 'Project not found' }, 404)
    }

    const input = c.req.valid('json')

    const [updated] = await db
      .update(projects)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning()

    if (!updated) {
      return c.json({ error: 'Project not found' }, 404)
    }

    return c.json(projectToResponse(updated), 200)
  })
  .delete('/:id', async (c) => {
    const id = c.req.param('id')

    const existing = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    })
    if (!existing) {
      return c.json({ error: 'Project not found' }, 404)
    }

    await db.delete(projects).where(eq(projects.id, id))

    return c.body(null, 204)
  })
