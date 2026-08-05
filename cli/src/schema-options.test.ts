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
  )
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

  it('throws at registration time for a schema field type it does not support', () => {
    const unsupportedSchema = z.object({ flag: z.boolean().optional() })

    const error = captureError(() =>
      addSchemaOptions(new Command(), unsupportedSchema),
    )

    expect(error.message).toBe(
      'addSchemaOptions: unsupported schema type for field "flag"',
    )
  })
})

describe('pickSchemaFields', () => {
  it('picks defined schema fields, skipping excluded and undefined ones', () => {
    const result = pickSchemaFields(
      testSchema,
      { status: 'open', priority: undefined, note: 'hi', file: 'ignored' },
      ['note'],
    )

    expect(result).toEqual({ status: 'open' })
  })

  it('returns an empty object when nothing is set', () => {
    expect(pickSchemaFields(testSchema, {})).toEqual({})
  })

  it('includes required schema fields too when present in options', () => {
    const result = pickSchemaFields(testSchema, { name: 'value' })

    expect(result).toEqual({ name: 'value' })
  })

  it('validates values even when called directly, bypassing addSchemaOptions', () => {
    const error = captureError(() =>
      pickSchemaFields(testSchema, { priority: 'not-a-number' }),
    )

    expect(error.message).toBe(
      'Invalid input: expected number, received string',
    )
  })
})
