import { Command, InvalidArgumentError, Option } from 'commander'
import { err, ok, Result } from 'neverthrow'
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
    // commander's argParser contract requires throwing InvalidArgumentError;
    // commander itself catches it and converts it into user-facing CLI error
    // output, so this can't return a Result.
    // eslint-disable-next-line no-restricted-syntax -- commander's argParser contract requires a synchronous throw
    throw new InvalidArgumentError(
      result.error.issues[0]?.message ?? 'Invalid value',
    )
  }
  return result.data
}

function isSupportedLeaf(
  field: z.core.$ZodType,
): field is z.ZodEnum | z.ZodString | z.ZodStringFormat | z.ZodNumber {
  return (
    field instanceof z.ZodEnum ||
    field instanceof z.ZodString ||
    field instanceof z.ZodStringFormat ||
    field instanceof z.ZodNumber
  )
}

/**
 * Unwraps `z.optional()`, `z.optional(z.nullable())`, and a trailing
 * `.transform()` (e.g. `status`'s single-or-array-to-array normalization)
 * into the leaf type used for flag validation and choices. For a
 * transform's pre-transform union (e.g. `z.union([taskStatus,
 * z.array(taskStatus)])`), the first supported member is used, since
 * `parseValue` only needs to validate a single raw flag value — the full
 * schema (with transform) re-validates it again in `pickSchemaFields`.
 * There is no way to send an explicit `null` through a flag, so a nullable
 * field (e.g. a project's `description`/`startDate`/`targetDate`/`color`)
 * cannot be cleared via the CLI yet — a known, accepted gap.
 */
function unwrapOptional(field: z.core.$ZodType): z.core.$ZodType | undefined {
  if (!(field instanceof z.ZodOptional)) return undefined
  let inner = field.unwrap()
  if (inner instanceof z.ZodNullable) inner = inner.unwrap()
  if (inner instanceof z.ZodPipe) inner = inner.in
  if (inner instanceof z.ZodUnion) {
    inner = inner.options.find(isSupportedLeaf) ?? inner
  }
  return inner
}

/**
 * Only wraps `z.optional()` fields into flags; required fields are left
 * for the caller to add as positional arguments instead, keeping the
 * flag/positional split without a per-command exclude list.
 *
 * `envDefaults` opts a field into falling back to an environment variable
 * when its flag is omitted (e.g. `{ context: 'TQ_CONTEXT' }`). It's
 * caller-supplied per call site, like `exclude`, rather than inferred from
 * the field name — a mutating command (e.g. `task update`) can share the
 * same schema field without silently picking up the env default and
 * overwriting an existing value the caller never asked to change.
 */
export function addSchemaOptions<Shape extends z.core.$ZodShape>(
  command: Command,
  schema: z.ZodObject<Shape>,
  exclude: readonly string[] = [],
  envDefaults: Readonly<Record<string, string>> = {},
): Result<Command, Error> {
  for (const [key, field] of Object.entries(schema.shape)) {
    if (exclude.includes(key)) continue
    const inner = unwrapOptional(field)
    if (inner === undefined) continue

    if (!isSupportedLeaf(inner)) {
      return err(
        new Error(
          `addSchemaOptions: unsupported schema type for field "${key}"`,
        ),
      )
    }

    const envVar = envDefaults[key]
    const description =
      envVar != null
        ? `${inner.description ?? toLabel(key)} (or set ${envVar})`
        : (inner.description ?? toLabel(key))
    const option = new Option(`--${toKebabCase(key)} <value>`, description)
    if (inner instanceof z.ZodEnum) {
      option.choices(inner.options.map(String))
    }

    option.argParser((raw: string) => parseValue(inner, raw))
    if (envVar != null) {
      const envValue = process.env[envVar]
      // Left unvalidated here (unlike an explicit flag, which goes through
      // parseValue above): pickSchemaFields re-validates the full options
      // object against the schema before it reaches the API, so an invalid
      // env value is still rejected by the CLI rather than sent.
      option.default(
        envValue != null && envValue.length > 0 ? envValue : undefined,
      )
    }
    command.addOption(option)
  }
  return ok(command)
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
    return err(new Error(result.error.issues[0]?.message ?? 'Invalid value'))
  }
  return ok(result.data)
}
