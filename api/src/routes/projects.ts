import { db } from '@api/db/connection'
import { projects, tasks } from '@api/db/schema'
import { taskToResponse } from '@api/routes/tasks'
import { zValidator } from '@hono/zod-validator'
import { and, count, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

const projectStatus = z.enum(['active', 'paused', 'completed', 'archived'])

const createProjectSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: projectStatus.optional(),
  startDate: z.string().optional(),
  targetDate: z.string().optional(),
  color: z.string().optional(),
  sortOrder: z.number().int().optional(),
})

const updateProjectSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: projectStatus.optional(),
  startDate: z.string().nullable().optional(),
  targetDate: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
})

const listQuerySchema = z.object({
  status: projectStatus.optional(),
})

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
  .get('/', zValidator('query', listQuerySchema), async (c) => {
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

    return c.json(result.map(projectToResponse), 200)
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

    const total = taskStats?.total ?? 0
    const completed = taskStats?.completed ?? 0

    return c.json(
      {
        ...projectToResponse(project),
        completionRate: total > 0 ? completed / total : 0,
        taskCount: { total, completed },
      },
      200,
    )
  })
  .get('/:id/tasks', async (c) => {
    const id = c.req.param('id')

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    })
    if (!project) {
      return c.json({ error: 'Project not found' }, 404)
    }

    const result = await db
      .select()
      .from(tasks)
      .where(eq(tasks.projectId, id))
      .orderBy(tasks.sortOrder, tasks.createdAt)

    return c.json(
      result.map((t) => taskToResponse(t)),
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
