import { eq, inArray } from 'drizzle-orm'
import type { z } from 'zod'

import type { DbTransaction } from '#db/connection'
import { db } from '#db/connection'
import { labels, recurringTaskTemplateLabels } from '#db/schema'
import type { contextEnum } from '#schemas/task'

// Full replacement, not add/remove: callers must pass the complete desired
// set of names each time, so an empty array clears every label from the
// template.
export async function syncTemplateLabels(
  tx: DbTransaction,
  templateId: string,
  names: string[],
  context: z.infer<typeof contextEnum>,
): Promise<string[]> {
  const uniqueNames = [...new Set(names)]

  await tx
    .delete(recurringTaskTemplateLabels)
    .where(eq(recurringTaskTemplateLabels.templateId, templateId))
  if (uniqueNames.length === 0) return []

  // onConflictDoNothing means `context` here only takes effect for a label
  // that doesn't exist yet; an existing label keeps its original context.
  await tx
    .insert(labels)
    .values(uniqueNames.map((name) => ({ name, context })))
    .onConflictDoNothing({ target: labels.name })

  const rows = await tx
    .select()
    .from(labels)
    .where(inArray(labels.name, uniqueNames))

  await tx
    .insert(recurringTaskTemplateLabels)
    .values(rows.map((label) => ({ templateId, labelId: label.id })))
    .onConflictDoNothing({
      target: [
        recurringTaskTemplateLabels.templateId,
        recurringTaskTemplateLabels.labelId,
      ],
    })

  return rows.map((label) => label.name)
}

export async function getTemplateLabelNames(
  templateId: string,
): Promise<string[]> {
  const rows = await db
    .select({ name: labels.name })
    .from(recurringTaskTemplateLabels)
    .innerJoin(labels, eq(recurringTaskTemplateLabels.labelId, labels.id))
    .where(eq(recurringTaskTemplateLabels.templateId, templateId))
  return rows.map((row) => row.name)
}

export async function getTemplateLabelNamesByTemplateIds(
  templateIds: string[],
): Promise<Map<string, string[]>> {
  if (templateIds.length === 0) return new Map()

  const rows = await db
    .select({
      templateId: recurringTaskTemplateLabels.templateId,
      name: labels.name,
    })
    .from(recurringTaskTemplateLabels)
    .innerJoin(labels, eq(recurringTaskTemplateLabels.labelId, labels.id))
    .where(inArray(recurringTaskTemplateLabels.templateId, templateIds))

  const map = new Map<string, string[]>()
  for (const row of rows) {
    const list = map.get(row.templateId) ?? []
    list.push(row.name)
    map.set(row.templateId, list)
  }
  return map
}
