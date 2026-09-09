import { zValidator } from '@hono/zod-validator'
import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'

import { db } from '#db/connection'
import { recurrenceRules, recurringTaskTemplates } from '#db/schema'
import { firstOrThrow } from '#lib/drizzle-utils'
import { recurrenceRuleToResponse, resolveParentId } from '#routes/tasks/shared'
import {
  createRecurringTaskTemplateSchema,
  listRecurringTaskTemplatesQuerySchema,
  updateRecurringTaskTemplateSchema,
} from '#schemas/recurring-task-template'
import {
  getTemplateLabelNames,
  getTemplateLabelNamesByTemplateIds,
  syncTemplateLabels,
} from '#services/recurring-task-template-labels'

function templateToResponse(
  template: typeof recurringTaskTemplates.$inferSelect,
  rule: typeof recurrenceRules.$inferSelect,
  labelNames: string[],
) {
  return {
    id: template.id,
    title: template.title,
    description: template.description,
    estimatedMinutes: template.estimatedMinutes,
    projectId: template.projectId,
    parentId: template.parentId,
    context: template.context,
    labels: labelNames,
    recurrenceRuleId: template.recurrenceRuleId,
    recurrenceRule: recurrenceRuleToResponse(rule),
    startOffsetDays: template.startOffsetDays,
    anchorDate: template.anchorDate,
    lastGeneratedDate: template.lastGeneratedDate,
    enabled: template.enabled,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  }
}

// `parentId` here names a task (the parent generated instances nest under),
// not another template, so it reuses the tasks id-or-number resolver.
async function resolveTemplateParentId(
  parentId: string | number | null,
): Promise<
  { id: string | null } | { error: { body: { error: string }; status: 404 } }
> {
  if (parentId == null) return { id: null }
  const resolved = await resolveParentId(parentId)
  return 'error' in resolved ? resolved : { id: resolved.id }
}

export const recurringTaskTemplatesApp = new Hono()
  .post(
    '/',
    zValidator('json', createRecurringTaskTemplateSchema),
    async (c) => {
      const input = c.req.valid('json')

      let parentId: string | null = null
      if (input.parentId != null) {
        const resolved = await resolveTemplateParentId(input.parentId)
        if ('error' in resolved) {
          return c.json(resolved.error.body, resolved.error.status)
        }
        parentId = resolved.id
      }

      const { template, rule, labelNames } = await db.transaction(
        async (tx) => {
          const rule = firstOrThrow(
            await tx
              .insert(recurrenceRules)
              .values({
                type: input.recurrenceRule.type,
                interval: input.recurrenceRule.interval,
                daysOfWeek: input.recurrenceRule.daysOfWeek ?? null,
                dayOfMonth: input.recurrenceRule.dayOfMonth ?? null,
              })
              .returning(),
          )

          const template = firstOrThrow(
            await tx
              .insert(recurringTaskTemplates)
              .values({
                title: input.title,
                description: input.description ?? null,
                estimatedMinutes: input.estimatedMinutes ?? null,
                projectId: input.projectId ?? null,
                parentId,
                context: input.context,
                recurrenceRuleId: rule.id,
                startOffsetDays: input.startOffsetDays ?? null,
                anchorDate: input.anchorDate,
                enabled: input.enabled ?? true,
              })
              .returning(),
          )

          const labelNames =
            input.labels != null
              ? await syncTemplateLabels(
                  tx,
                  template.id,
                  input.labels,
                  template.context,
                )
              : []

          return { template, rule, labelNames }
        },
      )

      return c.json(templateToResponse(template, rule, labelNames), 201)
    },
  )
  .get(
    '/',
    zValidator('query', listRecurringTaskTemplatesQuerySchema),
    async (c) => {
      const query = c.req.valid('query')
      const conditions = []
      if (query.context != null) {
        conditions.push(eq(recurringTaskTemplates.context, query.context))
      }
      if (query.enabled != null) {
        conditions.push(eq(recurringTaskTemplates.enabled, query.enabled))
      }

      const rows = await db
        .select({ template: recurringTaskTemplates, rule: recurrenceRules })
        .from(recurringTaskTemplates)
        .innerJoin(
          recurrenceRules,
          eq(recurringTaskTemplates.recurrenceRuleId, recurrenceRules.id),
        )
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(recurringTaskTemplates.createdAt)

      const labelsByTemplateId = await getTemplateLabelNamesByTemplateIds(
        rows.map((row) => row.template.id),
      )

      return c.json(
        rows.map((row) =>
          templateToResponse(
            row.template,
            row.rule,
            labelsByTemplateId.get(row.template.id) ?? [],
          ),
        ),
        200,
      )
    },
  )
  .get('/:id', async (c) => {
    const id = c.req.param('id')

    const rows = await db
      .select({ template: recurringTaskTemplates, rule: recurrenceRules })
      .from(recurringTaskTemplates)
      .innerJoin(
        recurrenceRules,
        eq(recurringTaskTemplates.recurrenceRuleId, recurrenceRules.id),
      )
      .where(eq(recurringTaskTemplates.id, id))

    const row = rows[0]
    if (!row) {
      return c.json({ error: 'Recurring task template not found' }, 404)
    }

    const labelNames = await getTemplateLabelNames(id)

    return c.json(templateToResponse(row.template, row.rule, labelNames), 200)
  })
  .patch(
    '/:id',
    zValidator('json', updateRecurringTaskTemplateSchema),
    async (c) => {
      const id = c.req.param('id')
      const existing = await db.query.recurringTaskTemplates.findFirst({
        where: eq(recurringTaskTemplates.id, id),
      })
      if (!existing) {
        return c.json({ error: 'Recurring task template not found' }, 404)
      }

      const {
        recurrenceRule: recurrenceRuleInput,
        labels: labelsInput,
        parentId: parentIdInput,
        ...fields
      } = c.req.valid('json')

      let parentId: string | null | undefined = undefined
      if (parentIdInput !== undefined) {
        const resolved = await resolveTemplateParentId(parentIdInput)
        if ('error' in resolved) {
          return c.json(resolved.error.body, resolved.error.status)
        }
        parentId = resolved.id
      }

      const { updatedTemplate, rule, labelNames } = await db.transaction(
        async (tx) => {
          const rule =
            recurrenceRuleInput !== undefined
              ? firstOrThrow(
                  await tx
                    .update(recurrenceRules)
                    .set({
                      type: recurrenceRuleInput.type,
                      interval: recurrenceRuleInput.interval,
                      daysOfWeek: recurrenceRuleInput.daysOfWeek ?? null,
                      dayOfMonth: recurrenceRuleInput.dayOfMonth ?? null,
                      updatedAt: new Date(),
                    })
                    .where(eq(recurrenceRules.id, existing.recurrenceRuleId))
                    .returning(),
                )
              : firstOrThrow(
                  await tx
                    .select()
                    .from(recurrenceRules)
                    .where(eq(recurrenceRules.id, existing.recurrenceRuleId)),
                )

          const updatedTemplate = firstOrThrow(
            await tx
              .update(recurringTaskTemplates)
              .set({
                ...fields,
                ...(parentId !== undefined ? { parentId } : {}),
                updatedAt: new Date(),
              })
              .where(eq(recurringTaskTemplates.id, id))
              .returning(),
          )

          const labelNames =
            labelsInput !== undefined
              ? await syncTemplateLabels(
                  tx,
                  id,
                  labelsInput,
                  updatedTemplate.context,
                )
              : await getTemplateLabelNames(id)

          return { updatedTemplate, rule, labelNames }
        },
      )

      return c.json(templateToResponse(updatedTemplate, rule, labelNames), 200)
    },
  )
  .delete('/:id', async (c) => {
    const id = c.req.param('id')
    const existing = await db.query.recurringTaskTemplates.findFirst({
      where: eq(recurringTaskTemplates.id, id),
    })
    if (!existing) {
      return c.json({ error: 'Recurring task template not found' }, 404)
    }

    await db.transaction(async (tx) => {
      await tx
        .delete(recurringTaskTemplates)
        .where(eq(recurringTaskTemplates.id, id))
      // Exclusively owned by this template (see schema comment), so no
      // other-reference check is needed before deleting the rule.
      await tx
        .delete(recurrenceRules)
        .where(eq(recurrenceRules.id, existing.recurrenceRuleId))
    })

    return c.body(null, 204)
  })
