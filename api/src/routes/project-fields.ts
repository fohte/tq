import { zValidator } from '@hono/zod-validator'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { Hono } from 'hono'

import { db } from '#db/connection'
import { projectFieldOptions, projectFields, projects } from '#db/schema'
import { setChangeEventTaskIds } from '#lib/change-events'
import {
  createProjectFieldSchema,
  projectFieldOptionNameSchema,
  projectFieldOptionParamSchema,
  projectFieldParamSchema,
  projectIdParamSchema,
  updateProjectFieldSchema,
} from '#schemas/project-field'
import { getTaskIdsWithFieldValue } from '#services/task-field-values'

function optionToResponse(option: typeof projectFieldOptions.$inferSelect) {
  return { id: option.id, name: option.name }
}

function fieldToResponse(
  field: typeof projectFields.$inferSelect,
  options: (typeof projectFieldOptions.$inferSelect)[],
) {
  return {
    id: field.id,
    projectId: field.projectId,
    name: field.name,
    type: field.type,
    options: options.map(optionToResponse),
    createdAt: field.createdAt.toISOString(),
    updatedAt: field.updatedAt.toISOString(),
  }
}

async function loadFieldResponse(
  field: typeof projectFields.$inferSelect,
  query: typeof db,
) {
  const options = await query
    .select()
    .from(projectFieldOptions)
    .where(eq(projectFieldOptions.fieldId, field.id))
    .orderBy(asc(projectFieldOptions.id))

  return fieldToResponse(field, options)
}

async function findField(projectId: string, fieldId: string) {
  const [field] = await db
    .select()
    .from(projectFields)
    .where(
      and(
        eq(projectFields.projectId, projectId),
        eq(projectFields.id, fieldId),
      ),
    )
    .limit(1)
  return field
}

export const projectFieldsApp = new Hono()
  .get('/', zValidator('param', projectIdParamSchema), async (c) => {
    const { projectId } = c.req.valid('param')
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1)
    if (!project) return c.json({ error: 'Project not found' }, 404)

    const fields = await db
      .select()
      .from(projectFields)
      .where(eq(projectFields.projectId, projectId))
      .orderBy(asc(projectFields.id))
    const options =
      fields.length === 0
        ? []
        : await db
            .select()
            .from(projectFieldOptions)
            .where(
              inArray(
                projectFieldOptions.fieldId,
                fields.map((field) => field.id),
              ),
            )
            .orderBy(asc(projectFieldOptions.id))
    const optionsByField = options.reduce<
      Map<string, (typeof options)[number][]>
    >((groups, option) => {
      const fieldOptions = groups.get(option.fieldId) ?? []
      fieldOptions.push(option)
      groups.set(option.fieldId, fieldOptions)
      return groups
    }, new Map())

    return c.json(
      fields.map((field) =>
        fieldToResponse(field, optionsByField.get(field.id) ?? []),
      ),
      200,
    )
  })
  .post(
    '/',
    zValidator('param', projectIdParamSchema),
    zValidator('json', createProjectFieldSchema),
    async (c) => {
      const { projectId } = c.req.valid('param')
      const input = c.req.valid('json')
      const optionNames = input.options ?? []
      if (new Set(optionNames).size !== optionNames.length) {
        return c.json({ error: 'An option with this name already exists' }, 409)
      }

      const result = await db.transaction(async (tx) => {
        const [project] = await tx
          .select({ id: projects.id })
          .from(projects)
          .where(eq(projects.id, projectId))
          .limit(1)
          .for('no key update')
        if (!project) return { kind: 'not-found' as const }

        const [field] = await tx
          .insert(projectFields)
          .values({
            projectId,
            name: input.name,
            type: input.type ?? 'single_select',
          })
          .onConflictDoNothing({
            target: [projectFields.projectId, projectFields.name],
          })
          .returning()
        if (!field) return { kind: 'conflict' as const }

        if (optionNames.length > 0) {
          await tx
            .insert(projectFieldOptions)
            .values(optionNames.map((name) => ({ fieldId: field.id, name })))
        }
        return { kind: 'created' as const, fieldId: field.id }
      })

      if (result.kind === 'not-found') {
        return c.json({ error: 'Project not found' }, 404)
      }
      if (result.kind === 'conflict') {
        return c.json({ error: 'A field with this name already exists' }, 409)
      }

      const field = await findField(projectId, result.fieldId)
      if (!field) return c.json({ error: 'Field not found' }, 404)
      return c.json(await loadFieldResponse(field, db), 201)
    },
  )
  .patch(
    '/:fieldId',
    zValidator('param', projectFieldParamSchema),
    zValidator('json', updateProjectFieldSchema),
    async (c) => {
      const { projectId, fieldId } = c.req.valid('param')
      const input = c.req.valid('json')
      const result = await db.transaction(async (tx) => {
        const [project] = await tx
          .select({ id: projects.id })
          .from(projects)
          .where(eq(projects.id, projectId))
          .limit(1)
          .for('no key update')
        if (!project) return { kind: 'not-found' as const }

        const [existing] = await tx
          .select()
          .from(projectFields)
          .where(
            and(
              eq(projectFields.projectId, projectId),
              eq(projectFields.id, fieldId),
            ),
          )
          .limit(1)
        if (!existing) return { kind: 'not-found' as const }

        if (input.name !== existing.name) {
          const [conflicting] = await tx
            .select({ id: projectFields.id })
            .from(projectFields)
            .where(
              and(
                eq(projectFields.projectId, projectId),
                eq(projectFields.name, input.name),
              ),
            )
            .limit(1)
          if (conflicting) return { kind: 'conflict' as const }
        }

        const [updated] = await tx
          .update(projectFields)
          .set({ name: input.name, updatedAt: new Date() })
          .where(
            and(
              eq(projectFields.projectId, projectId),
              eq(projectFields.id, fieldId),
            ),
          )
          .returning()
        return updated
          ? { kind: 'updated' as const, field: updated }
          : { kind: 'not-found' as const }
      })

      if (result.kind === 'conflict') {
        return c.json({ error: 'A field with this name already exists' }, 409)
      }
      if (result.kind === 'not-found') {
        return c.json({ error: 'Field not found' }, 404)
      }
      setChangeEventTaskIds(c, await getTaskIdsWithFieldValue({ fieldId }))
      return c.json(await loadFieldResponse(result.field, db), 200)
    },
  )
  .delete(
    '/:fieldId',
    zValidator('param', projectFieldParamSchema),
    async (c) => {
      const { projectId, fieldId } = c.req.valid('param')
      const existing = await findField(projectId, fieldId)
      if (!existing) return c.json({ error: 'Field not found' }, 404)

      const affectedTaskIds = await getTaskIdsWithFieldValue({ fieldId })

      await db
        .delete(projectFields)
        .where(
          and(
            eq(projectFields.projectId, projectId),
            eq(projectFields.id, fieldId),
          ),
        )
      setChangeEventTaskIds(c, affectedTaskIds)
      return c.body(null, 204)
    },
  )
  .post(
    '/:fieldId/options',
    zValidator('param', projectFieldParamSchema),
    zValidator('json', projectFieldOptionNameSchema),
    async (c) => {
      const { projectId, fieldId } = c.req.valid('param')
      const input = c.req.valid('json')
      const result = await db.transaction(async (tx) => {
        const [field] = await tx
          .select({ id: projectFields.id })
          .from(projectFields)
          .where(
            and(
              eq(projectFields.projectId, projectId),
              eq(projectFields.id, fieldId),
            ),
          )
          .limit(1)
          .for('no key update')
        if (!field) return { kind: 'not-found' as const }

        const [created] = await tx
          .insert(projectFieldOptions)
          .values({ fieldId, name: input.name })
          .onConflictDoNothing({
            target: [projectFieldOptions.fieldId, projectFieldOptions.name],
          })
          .returning()
        return created
          ? { kind: 'created' as const, option: created }
          : { kind: 'conflict' as const }
      })

      if (result.kind === 'not-found') {
        return c.json({ error: 'Field not found' }, 404)
      }
      if (result.kind === 'conflict') {
        return c.json({ error: 'An option with this name already exists' }, 409)
      }
      return c.json(optionToResponse(result.option), 201)
    },
  )
  .patch(
    '/:fieldId/options/:optionId',
    zValidator('param', projectFieldOptionParamSchema),
    zValidator('json', projectFieldOptionNameSchema),
    async (c) => {
      const { projectId, fieldId, optionId } = c.req.valid('param')
      const input = c.req.valid('json')
      const result = await db.transaction(async (tx) => {
        const [field] = await tx
          .select({ id: projectFields.id })
          .from(projectFields)
          .where(
            and(
              eq(projectFields.projectId, projectId),
              eq(projectFields.id, fieldId),
            ),
          )
          .limit(1)
          .for('no key update')
        if (!field) return { kind: 'not-found' as const }

        const [existing] = await tx
          .select()
          .from(projectFieldOptions)
          .where(
            and(
              eq(projectFieldOptions.fieldId, fieldId),
              eq(projectFieldOptions.id, optionId),
            ),
          )
          .limit(1)
        if (!existing) return { kind: 'option-not-found' as const }

        if (input.name !== existing.name) {
          const [conflicting] = await tx
            .select({ id: projectFieldOptions.id })
            .from(projectFieldOptions)
            .where(
              and(
                eq(projectFieldOptions.fieldId, fieldId),
                eq(projectFieldOptions.name, input.name),
              ),
            )
            .limit(1)
          if (conflicting) return { kind: 'conflict' as const }
        }

        const [updated] = await tx
          .update(projectFieldOptions)
          .set({ name: input.name, updatedAt: new Date() })
          .where(
            and(
              eq(projectFieldOptions.fieldId, fieldId),
              eq(projectFieldOptions.id, optionId),
            ),
          )
          .returning()
        return updated
          ? { kind: 'updated' as const, option: updated }
          : { kind: 'option-not-found' as const }
      })

      if (result.kind === 'not-found') {
        return c.json({ error: 'Field not found' }, 404)
      }
      if (result.kind === 'option-not-found') {
        return c.json({ error: 'Option not found' }, 404)
      }
      if (result.kind === 'conflict') {
        return c.json({ error: 'An option with this name already exists' }, 409)
      }
      setChangeEventTaskIds(c, await getTaskIdsWithFieldValue({ optionId }))
      return c.json(optionToResponse(result.option), 200)
    },
  )
  .delete(
    '/:fieldId/options/:optionId',
    zValidator('param', projectFieldOptionParamSchema),
    async (c) => {
      const { projectId, fieldId, optionId } = c.req.valid('param')
      if (!(await findField(projectId, fieldId))) {
        return c.json({ error: 'Field not found' }, 404)
      }

      const affectedTaskIds = await getTaskIdsWithFieldValue({ optionId })

      const [deleted] = await db
        .delete(projectFieldOptions)
        .where(
          and(
            eq(projectFieldOptions.fieldId, fieldId),
            eq(projectFieldOptions.id, optionId),
          ),
        )
        .returning({ id: projectFieldOptions.id })
      if (!deleted) return c.json({ error: 'Option not found' }, 404)
      setChangeEventTaskIds(c, affectedTaskIds)
      return c.body(null, 204)
    },
  )
