import { Command } from 'commander'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { addSchemaOptions, pickSchemaFields } from '#schema-options'

const testSchema = z.object({
  name: z.string().min(1),
  status: z.enum(['open', 'closed']).describe('Current status').optional(),
  priority: z.number().int().optional(),
  note: z.string().optional(),
})

function buildCommand(exclude: string[] = []): Command {
  return addSchemaOptions(
    new Command('test').exitOverride(),
    testSchema,
    exclude,
  )._unsafeUnwrap()
}

function captureError(run: () => void): Error {
  try {
    run()
  } catch (error) {
    if (error instanceof Error) return error
    throw error
  }
  throw new Error('expected run() to throw')
}

describe('addSchemaOptions', () => {
  it('shows one flag per optional field in --help — schema description, enum choices, a humanized fallback label, and never the required field', () => {
    expect(buildCommand().helpInformation()).toBe(
      `Usage: test [options]

Options:
  --status <value>    Current status (choices: "open", "closed")
  --priority <value>  Priority
  --note <value>      Note
  -h, --help          display help for command
`,
    )
  })

  it('drops an excluded field from --help even when optional', () => {
    expect(buildCommand(['note']).helpInformation()).toBe(
      `Usage: test [options]

Options:
  --status <value>    Current status (choices: "open", "closed")
  --priority <value>  Priority
  -h, --help          display help for command
`,
    )
  })

  it('converts and validates a valid value through the schema', () => {
    const command = buildCommand()

    command.parse(['--priority', '3'], { from: 'user' })

    expect(command.opts()).toEqual({ priority: 3 })
  })

  it('rejects a value the schema does not accept', () => {
    const error = captureError(() =>
      buildCommand().parse(['--priority', 'abc'], { from: 'user' }),
    )

    expect(error.message).toBe(
      "error: option '--priority <value>' argument 'abc' is invalid. Invalid input: expected number, received NaN",
    )
  })

  it("rejects an enum value outside the schema's choices", () => {
    const error = captureError(() =>
      buildCommand().parse(['--status', 'archived'], { from: 'user' }),
    )

    expect(error.message).toBe(
      'error: option \'--status <value>\' argument \'archived\' is invalid. Invalid option: expected one of "open"|"closed"',
    )
  })

  it('returns an Err at registration time for a schema field type it does not support', () => {
    const unsupportedSchema = z.object({ flag: z.boolean().optional() })

    const result = addSchemaOptions(new Command(), unsupportedSchema)

    expect(result._unsafeUnwrapErr().message).toBe(
      'addSchemaOptions: unsupported schema type for field "flag"',
    )
  })

  it('shows a z.uuid() field in --help without an enum choices suffix', () => {
    const uuidSchema = z.object({ id: z.uuid().optional() })
    const command = addSchemaOptions(
      new Command('test').exitOverride(),
      uuidSchema,
    )._unsafeUnwrap()

    expect(command.helpInformation()).toBe(
      `Usage: test [options]

Options:
  --id <value>  Id
  -h, --help    display help for command
`,
    )
  })

  it('converts and validates a valid z.uuid() value', () => {
    const uuidSchema = z.object({ id: z.uuid().optional() })
    const command = addSchemaOptions(
      new Command('test').exitOverride(),
      uuidSchema,
    )._unsafeUnwrap()

    command.parse(['--id', '123e4567-e89b-12d3-a456-426614174000'], {
      from: 'user',
    })

    expect(command.opts()).toEqual({
      id: '123e4567-e89b-12d3-a456-426614174000',
    })
  })

  it('rejects a value that does not match the z.uuid() format', () => {
    const uuidSchema = z.object({ id: z.uuid().optional() })
    const command = addSchemaOptions(
      new Command('test').exitOverride(),
      uuidSchema,
    )._unsafeUnwrap()
    const error = captureError(() =>
      command.parse(['--id', 'not-a-uuid'], { from: 'user' }),
    )

    expect(error.message).toBe(
      "error: option '--id <value>' argument 'not-a-uuid' is invalid. Invalid UUID",
    )
  })

  it('unwraps a .nullable().optional() field into a working flag', () => {
    const nullableSchema = z.object({ note: z.string().nullable().optional() })
    const command = addSchemaOptions(
      new Command('test').exitOverride(),
      nullableSchema,
    )._unsafeUnwrap()

    command.parse(['--note', 'hello'], { from: 'user' })

    expect(command.opts()).toEqual({ note: 'hello' })
  })
})

describe('pickSchemaFields', () => {
  it('picks defined schema fields, skipping excluded and undefined ones', () => {
    const result = pickSchemaFields(
      testSchema,
      { status: 'open', priority: undefined, note: 'hi', file: 'ignored' },
      ['note'],
    )

    expect(result._unsafeUnwrap()).toEqual({ status: 'open' })
  })

  it('returns an empty object when nothing is set', () => {
    expect(pickSchemaFields(testSchema, {})._unsafeUnwrap()).toEqual({})
  })

  it('includes required schema fields too when present in options', () => {
    const result = pickSchemaFields(testSchema, { name: 'value' })

    expect(result._unsafeUnwrap()).toEqual({ name: 'value' })
  })

  it('returns an Err when called directly with an invalid value, bypassing addSchemaOptions', () => {
    const result = pickSchemaFields(testSchema, { priority: 'not-a-number' })

    expect(result._unsafeUnwrapErr().message).toBe(
      'Invalid input: expected number, received string',
    )
  })
})

describe('a nullable optional field (z.string().nullable().optional())', () => {
  const nullableSchema = z.object({
    description: z.string().nullable().optional(),
  })

  it('gets a working --flag <value> in --help instead of "unsupported schema type"', () => {
    const command = addSchemaOptions(
      new Command('test').exitOverride(),
      nullableSchema,
    )._unsafeUnwrap()

    expect(command.helpInformation()).toBe(
      `Usage: test [options]

Options:
  --description <value>  Description
  -h, --help             display help for command
`,
    )
  })

  it('round-trips a string value through pickSchemaFields', () => {
    const result = pickSchemaFields(nullableSchema, {
      description: 'hello',
    })

    expect(result._unsafeUnwrap()).toEqual({ description: 'hello' })
  })
})
