import { Command, InvalidArgumentError, Option } from 'commander'
import { z } from 'zod'

function toKebabCase(key: string): string {
  return key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)
}

function toLabel(key: string): string {
  const words = toKebabCase(key).split('-')
  return words
    .map((word, index) =>
      index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word,
    )
    .join(' ')
}

function parseValue(inner: z.ZodType, raw: string): unknown {
  const value = inner instanceof z.ZodNumber ? Number(raw) : raw
  const result = inner.safeParse(value)
  if (!result.success) {
    throw new InvalidArgumentError(
      result.error.issues[0]?.message ?? 'Invalid value',
    )
  }
  return result.data
}

/**
 * Only wraps `z.optional()` fields into flags; required fields are left
 * for the caller to add as positional arguments instead, keeping the
 * flag/positional split without a per-command exclude list.
 */
export function addSchemaOptions<Shape extends z.core.$ZodShape>(
  command: Command,
  schema: z.ZodObject<Shape>,
  exclude: readonly string[] = [],
): Command {
  for (const [key, field] of Object.entries(schema.shape)) {
    if (exclude.includes(key) || !(field instanceof z.ZodOptional)) continue

    let inner = field.unwrap()
    // A nullable field's flag can only set a value — there's no flag syntax here for passing an explicit null back through.
    if (inner instanceof z.ZodNullable) {
      inner = inner.unwrap()
    }
    if (
      !(inner instanceof z.ZodEnum) &&
      !(inner instanceof z.ZodString) &&
      !(inner instanceof z.ZodStringFormat) &&
      !(inner instanceof z.ZodNumber)
    ) {
      throw new Error(
        `addSchemaOptions: unsupported schema type for field "${key}"`,
      )
    }

    const option = new Option(
      `--${toKebabCase(key)} <value>`,
      inner.description ?? toLabel(key),
    )
    if (inner instanceof z.ZodEnum) {
      option.choices(inner.options.map(String))
    }

    option.argParser((raw: string) => parseValue(inner, raw))
    command.addOption(option)
  }
  return command
}

/**
 * Commander camelCases flag names back to the schema's own keys, so
 * picking is a direct lookup with no per-field mapping to maintain.
 * Re-validates against `schema`, so this is safe to call even with
 * `options` that didn't go through `addSchemaOptions`'s argParser.
 */
export function pickSchemaFields<Shape extends z.core.$ZodShape>(
  schema: z.ZodObject<Shape>,
  options: Record<string, unknown>,
  exclude: readonly string[] = [],
) {
  const picked: Record<string, unknown> = {}
  for (const key of Object.keys(schema.shape)) {
    if (exclude.includes(key)) continue
    const value = options[key]
    if (value !== undefined) picked[key] = value
  }

  const result = schema.partial().safeParse(picked)
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? 'Invalid value')
  }
  return result.data
}
