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
 * Adds one `--<field> <value>` Option per optional field of `schema` to
 * `command`. Required fields are skipped: they're the caller's job to wire
 * up as positional arguments instead of flags.
 *
 * Choices (for enum fields), value validation, and the option description
 * all come from the schema, so adding a field there is enough to grow the
 * CLI surface — no per-field CLI code needed.
 */
export function addSchemaOptions<Shape extends z.core.$ZodShape>(
  command: Command,
  schema: z.ZodObject<Shape>,
  exclude: readonly string[] = [],
): Command {
  for (const [key, field] of Object.entries(schema.shape)) {
    if (exclude.includes(key) || !(field instanceof z.ZodOptional)) continue

    const inner = field.unwrap()
    if (
      !(inner instanceof z.ZodEnum) &&
      !(inner instanceof z.ZodString) &&
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
 * Picks the fields of `schema` that are present (non-`undefined`) in
 * `options`, skipping `exclude`. Commander camelCases flag names back to
 * the schema's own keys, so this is a direct lookup with no per-field
 * mapping to maintain.
 */
export function pickSchemaFields<Shape extends z.core.$ZodShape>(
  schema: z.ZodObject<Shape>,
  options: Record<string, unknown>,
  exclude: readonly string[] = [],
): Partial<z.infer<z.ZodObject<Shape>>> {
  const result: Record<string, unknown> = {}
  for (const key of Object.keys(schema.shape)) {
    if (exclude.includes(key)) continue
    const value = options[key]
    if (value !== undefined) result[key] = value
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- values were already validated by the argParser each flag was registered with in addSchemaOptions; this loop only re-groups them by key
  return result as Partial<z.infer<z.ZodObject<Shape>>>
}
