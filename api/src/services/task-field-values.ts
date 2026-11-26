import { and, asc, eq, inArray } from 'drizzle-orm'

import { db, type DbTransaction } from '#db/connection'
import { projectFieldOptions, projectFields, taskFieldValues } from '#db/schema'

export type TaskFieldValue = {
  fieldId: string
  fieldName: string
  optionId: string
  optionName: string
}

export type ResolvedTaskFieldValues = {
  set: Array<{ fieldId: string; optionId: string }>
  clearFieldIds: string[]
}

export async function resolveTaskFieldValues(
  tx: DbTransaction,
  projectId: string | null,
  values: Record<string, string | null>,
): Promise<{ error: string } | { values: ResolvedTaskFieldValues }> {
  const requested = Object.entries(values)
  if (projectId == null) {
    if (requested.some(([, option]) => option !== null)) {
      return { error: 'Task field values require a project' }
    }
    return { values: { set: [], clearFieldIds: [] } }
  }

  const fields = await tx
    .select()
    .from(projectFields)
    .where(eq(projectFields.projectId, projectId))
    .orderBy(asc(projectFields.id))
    .for('key share')
  const fieldById = new Map(fields.map((field) => [field.id, field]))
  const fieldByName = new Map(fields.map((field) => [field.name, field]))
  const fieldByKey = new Map<string, (typeof fields)[number]>()
  for (const [key] of requested) {
    const field = fieldById.get(key) ?? fieldByName.get(key)
    if (!field) return { error: `Field not found: ${key}` }
    fieldByKey.set(key, field)
  }

  const options = await tx
    .select()
    .from(projectFieldOptions)
    .where(
      inArray(
        projectFieldOptions.fieldId,
        fields.map((field) => field.id),
      ),
    )
    .for('key share')
  const optionsById = new Map(options.map((option) => [option.id, option]))
  const optionsByFieldName = new Map(
    options.map((option) => [`${option.fieldId}\u0000${option.name}`, option]),
  )
  const selected: ResolvedTaskFieldValues = { set: [], clearFieldIds: [] }

  for (const [key, value] of requested) {
    const field = fieldByKey.get(key)
    if (!field) return { error: `Field not found: ${key}` }
    if (value === null) {
      selected.clearFieldIds.push(field.id)
      continue
    }

    const option =
      optionsById.get(value)?.fieldId === field.id
        ? optionsById.get(value)
        : optionsByFieldName.get(`${field.id}\u0000${value}`)
    if (!option) return { error: `Option not found for field: ${key}` }
    selected.set.push({ fieldId: field.id, optionId: option.id })
  }

  return { values: selected }
}

export async function applyTaskFieldValues(
  tx: DbTransaction,
  taskId: string,
  projectId: string,
  values: ResolvedTaskFieldValues,
) {
  for (const fieldId of values.clearFieldIds) {
    await tx
      .delete(taskFieldValues)
      .where(
        and(
          eq(taskFieldValues.taskId, taskId),
          eq(taskFieldValues.fieldId, fieldId),
        ),
      )
  }
  for (const value of values.set) {
    await tx
      .insert(taskFieldValues)
      .values({
        taskId,
        projectId,
        fieldId: value.fieldId,
        optionId: value.optionId,
      })
      .onConflictDoUpdate({
        target: [taskFieldValues.taskId, taskFieldValues.fieldId],
        set: { projectId, optionId: value.optionId, updatedAt: new Date() },
      })
  }
}

export async function getTaskFieldValuesByTaskId(
  taskIds: string[],
): Promise<Map<string, TaskFieldValue[]>> {
  if (taskIds.length === 0) return new Map()
  const rows = await db
    .select({
      taskId: taskFieldValues.taskId,
      fieldId: projectFields.id,
      fieldName: projectFields.name,
      optionId: projectFieldOptions.id,
      optionName: projectFieldOptions.name,
    })
    .from(taskFieldValues)
    .innerJoin(projectFields, eq(taskFieldValues.fieldId, projectFields.id))
    .innerJoin(
      projectFieldOptions,
      eq(taskFieldValues.optionId, projectFieldOptions.id),
    )
    .where(inArray(taskFieldValues.taskId, taskIds))
    .orderBy(asc(projectFields.id))

  const valuesByTaskId = new Map<string, TaskFieldValue[]>()
  for (const row of rows) {
    const values = valuesByTaskId.get(row.taskId) ?? []
    values.push({
      fieldId: row.fieldId,
      fieldName: row.fieldName,
      optionId: row.optionId,
      optionName: row.optionName,
    })
    valuesByTaskId.set(row.taskId, values)
  }
  return valuesByTaskId
}

export async function getTaskIdsWithFieldValue(
  condition:
    | { fieldId: string; optionId?: never }
    | { fieldId?: never; optionId: string },
): Promise<string[]> {
  const rows = await db
    .select({ taskId: taskFieldValues.taskId })
    .from(taskFieldValues)
    .where(
      condition.fieldId == null
        ? eq(taskFieldValues.optionId, condition.optionId)
        : eq(taskFieldValues.fieldId, condition.fieldId),
    )
    .orderBy(asc(taskFieldValues.taskId))
  return [...new Set(rows.map((row) => row.taskId))]
}
