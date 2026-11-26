import { z } from 'zod'

const fieldValuesDescription =
  'Project custom field values keyed by a non-empty field id or name, with option id or name as values. Use null to clear a field.'

const encodedFieldValuesSchema = z
  .record(z.string().min(1), z.string().nullable())
  .transform((values) =>
    Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key.slice(1), value]),
    ),
  )

function encodeFieldValueKeys(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return value
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, option]) => [
      key.length === 0 ? key : `\u0000${key}`,
      option,
    ]),
  )
}

export const taskFieldValuesSchema: z.ZodType<Record<string, string | null>> = z
  .preprocess(encodeFieldValueKeys, encodedFieldValuesSchema)
  .describe(fieldValuesDescription)
