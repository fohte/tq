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
  return addSchemaOptions(new Command().exitOverride(), testSchema, exclude)
}

describe('addSchemaOptions', () => {
  it('adds a flag per optional field, using the schema description or a humanized fallback', () => {
    const flags = buildCommand().options.map((option) => [
      option.long,
      option.description,
    ])

    expect(flags).toEqual([
      ['--status', 'Current status'],
      ['--priority', 'Priority'],
      ['--note', 'Note'],
    ])
  })

  it("skips required fields, since those are the caller's positional arguments", () => {
    const command = buildCommand()

    expect(command.options.some((option) => option.long === '--name')).toBe(
      false,
    )
  })

  it('skips excluded fields even when optional', () => {
    const command = buildCommand(['note'])

    expect(command.options.some((option) => option.long === '--note')).toBe(
      false,
    )
  })

  it('exposes enum choices for --help', () => {
    const status = buildCommand().options.find(
      (option) => option.long === '--status',
    )

    expect(status?.argChoices).toEqual(['open', 'closed'])
  })

  it('converts and validates a valid value through the schema', () => {
    const command = buildCommand()

    command.parse(['--priority', '3'], { from: 'user' })

    expect(command.opts()).toEqual({ priority: 3 })
  })

  it('rejects a value the schema does not accept', () => {
    const command = buildCommand()

    expect(() =>
      command.parse(['--priority', 'abc'], { from: 'user' }),
    ).toThrow(/expected number/i)
  })

  it("rejects an enum value outside the schema's choices", () => {
    const command = buildCommand()

    expect(() =>
      command.parse(['--status', 'archived'], { from: 'user' }),
    ).toThrow(/expected one of/i)
  })

  it('throws at registration time for a schema field type it does not support', () => {
    const unsupportedSchema = z.object({ flag: z.boolean().optional() })

    expect(() => addSchemaOptions(new Command(), unsupportedSchema)).toThrow(
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
})
