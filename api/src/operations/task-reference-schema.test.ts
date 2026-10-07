import { expect, it } from 'vitest'
import { z } from 'zod'

import { operations } from '#operations/index'

const taskNumber = '456'
const invalidTaskReference = 'not-a-task-reference'
type OperationInputSchema = z.ZodObject<Readonly<Record<string, z.ZodType>>>

function isTaskReferenceField(
  operationPath: readonly string[],
  fieldName: string,
) {
  const normalizedName = fieldName.toLowerCase()

  return (
    normalizedName === 'taskid' ||
    normalizedName === 'taskids' ||
    normalizedName.endsWith('taskid') ||
    normalizedName.endsWith('taskids') ||
    normalizedName === 'parentid' ||
    normalizedName === 'descendantof' ||
    normalizedName === 'blockedby' ||
    normalizedName.startsWith('duplicateof') ||
    (operationPath[0] === 'task' &&
      (normalizedName === 'id' || normalizedName === 'ids'))
  )
}

function isListTaskReference(fieldName: string) {
  const normalizedName = fieldName.toLowerCase()
  return (
    normalizedName === 'taskids' ||
    normalizedName.endsWith('taskids') ||
    normalizedName === 'ids' ||
    normalizedName === 'blockedby'
  )
}

it('accepts task numbers in every operation task reference schema', () => {
  const invalidSchemas = operations.flatMap((operation) => {
    const schemas: { name: string; schema: OperationInputSchema }[] = [
      { name: 'inputSchema', schema: operation.inputSchema },
    ]
    if ('mcpInputSchema' in operation) {
      schemas.push({ name: 'mcpInputSchema', schema: operation.mcpInputSchema })
    }

    return schemas.flatMap(({ name: schemaName, schema }) =>
      Object.entries(schema.shape).flatMap(([fieldName, fieldSchema]) => {
        if (!isTaskReferenceField(operation.path, fieldName)) return []

        const isListField = isListTaskReference(fieldName)
        const isStringEncodedTaskIdFilter =
          operation.path[0] === 'task' &&
          (operation.path[1] === 'list' || operation.path[1] === 'search') &&
          fieldName.toLowerCase() === 'ids'
        const taskNumberInputs = isStringEncodedTaskIdFilter
          ? [taskNumber, [taskNumber]]
          : isListField
            ? [[taskNumber], [456]]
            : [taskNumber, 456]
        const invalidTaskReferenceInput = isListField
          ? [invalidTaskReference]
          : invalidTaskReference
        const acceptsTaskNumber = taskNumberInputs.every(
          (input) => fieldSchema.safeParse(input).success,
        )
        const rejectsInvalidTaskReference = !fieldSchema.safeParse(
          invalidTaskReferenceInput,
        ).success

        return acceptsTaskNumber && rejectsInvalidTaskReference
          ? []
          : [
              {
                operation: operation.path.join(' '),
                schema: schemaName,
                field: fieldName,
                acceptsTaskNumber,
                rejectsInvalidTaskReference,
              },
            ]
      }),
    )
  })

  expect(invalidSchemas).toEqual([])
})
