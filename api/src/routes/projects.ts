import { zValidator } from '@hono/zod-validator'
import { and, count, eq, inArray, sql } from 'drizzle-orm'
import { Hono } from 'hono'

import { db } from '#db/connection'
import { projects, tasks } from '#db/schema'
import {
  createProjectSchema,
  listProjectsQuerySchema,
  updateProjectSchema,
} from '#schemas/project'

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
    context: project.context,
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
        context: input.context ?? 'personal',
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
    if (query.context) {
      conditions.push(eq(projects.context, query.context))
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
    const id = c.req.param('id')

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    })
    if (!project) {
      return c.json({ error: 'Project not found' }, 404)
    }

    const [taskStats] = await db
      .select({
        total: count(),
        completed: count(
          sql`CASE WHEN ${tasks.status} = 'completed' THEN 1 END`,
        ),
      })
      .from(tasks)
      .where(eq(tasks.projectId, id))

    return c.json(
      {
        ...projectToResponse(project),
        ...taskStatsToSummary(taskStats?.total ?? 0, taskStats?.completed ?? 0),
      },
      200,
    )
  })
  .get('/:id/task-ids', async (c) => {
    const id = c.req.param('id')

    const result = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(eq(tasks.projectId, id))

    return c.json(
      result.map((task) => task.id),
      200,
    )
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
