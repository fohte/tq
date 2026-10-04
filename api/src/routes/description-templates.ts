import { zValidator } from '@hono/zod-validator'
import { asc, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'

import { db } from '#db/connection'
import { taskDescriptionTemplates } from '#db/schema'
import {
  createDescriptionTemplateSchema,
  descriptionTemplateParamsSchema,
  updateDescriptionTemplateSchema,
} from '#schemas/description-template'

function descriptionTemplateToResponse(
  template: typeof taskDescriptionTemplates.$inferSelect,
) {
  return {
    id: template.id,
    name: template.name,
    whenToUse: template.whenToUse,
    body: template.body,
    guide: template.guide,
    isDefault: template.isDefault,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  }
}

export const descriptionTemplatesApp = new Hono()
  .post('/', zValidator('json', createDescriptionTemplateSchema), async (c) => {
    const input = c.req.valid('json')
    const conflicting = await db.query.taskDescriptionTemplates.findFirst({
      where: eq(taskDescriptionTemplates.name, input.name),
    })
    if (conflicting) {
      return c.json(
        { error: 'A description template with this name already exists' },
        409,
      )
    }

    const created = await db.transaction(async (tx) => {
      if (input.isDefault === true) {
        await tx
          .update(taskDescriptionTemplates)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(eq(taskDescriptionTemplates.isDefault, true))
      }

      const [template] = await tx
        .insert(taskDescriptionTemplates)
        .values({
          name: input.name,
          whenToUse: input.whenToUse,
          body: input.body,
          guide: input.guide,
          isDefault: input.isDefault ?? false,
        })
        .returning()

      return template
    })

    if (!created) {
      return c.json({ error: 'Failed to create description template' }, 500)
    }

    return c.json(descriptionTemplateToResponse(created), 201)
  })
  .get('/', async (c) => {
    const templates = await db
      .select()
      .from(taskDescriptionTemplates)
      .orderBy(
        desc(taskDescriptionTemplates.isDefault),
        asc(taskDescriptionTemplates.name),
      )

    return c.json(templates.map(descriptionTemplateToResponse), 200)
  })
  .get(
    '/:name',
    zValidator('param', descriptionTemplateParamsSchema),
    async (c) => {
      const { name } = c.req.valid('param')

      const template = await db.query.taskDescriptionTemplates.findFirst({
        where: eq(taskDescriptionTemplates.name, name),
      })
      if (!template) {
        return c.json({ error: 'Description template not found' }, 404)
      }

      return c.json(descriptionTemplateToResponse(template), 200)
    },
  )
  .patch(
    '/:name',
    zValidator('param', descriptionTemplateParamsSchema),
    zValidator('json', updateDescriptionTemplateSchema),
    async (c) => {
      const { name } = c.req.valid('param')
      const existing = await db.query.taskDescriptionTemplates.findFirst({
        where: eq(taskDescriptionTemplates.name, name),
      })
      if (!existing) {
        return c.json({ error: 'Description template not found' }, 404)
      }

      const input = c.req.valid('json')
      if (Object.keys(input).length === 0) {
        return c.json({ error: 'At least one field must be provided' }, 400)
      }

      if (input.name !== undefined && input.name !== existing.name) {
        const conflicting = await db.query.taskDescriptionTemplates.findFirst({
          where: eq(taskDescriptionTemplates.name, input.name),
        })
        if (conflicting) {
          return c.json(
            { error: 'A description template with this name already exists' },
            409,
          )
        }
      }

      const updated = await db.transaction(async (tx) => {
        if (input.isDefault === true) {
          await tx
            .update(taskDescriptionTemplates)
            .set({ isDefault: false, updatedAt: new Date() })
            .where(eq(taskDescriptionTemplates.isDefault, true))
        }

        const [template] = await tx
          .update(taskDescriptionTemplates)
          .set({ ...input, updatedAt: new Date() })
          .where(eq(taskDescriptionTemplates.name, name))
          .returning()

        return template
      })

      if (!updated) {
        return c.json({ error: 'Description template not found' }, 404)
      }

      return c.json(descriptionTemplateToResponse(updated), 200)
    },
  )
  .delete(
    '/:name',
    zValidator('param', descriptionTemplateParamsSchema),
    async (c) => {
      const { name } = c.req.valid('param')
      const [deleted] = await db
        .delete(taskDescriptionTemplates)
        .where(eq(taskDescriptionTemplates.name, name))
        .returning({ id: taskDescriptionTemplates.id })
      if (!deleted) {
        return c.json({ error: 'Description template not found' }, 404)
      }

      return c.body(null, 204)
    },
  )
