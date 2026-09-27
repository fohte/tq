import type { OperationDefinition } from 'api/operations'

import { pickSchemaFields } from '#schema-options'

export function positionalName(
  argument: OperationDefinition['positionalArgs'][number],
) {
  return typeof argument === 'string'
    ? argument
    : (argument.field ?? argument.name)
}

export function positionalSyntax(
  argument: OperationDefinition['positionalArgs'][number],
) {
  if (typeof argument === 'string') return `<${argument}>`

  const name = `${argument.name}${argument.variadic === true ? '...' : ''}`
  return argument.optional === true ? `[${name}]` : `<${name}>`
}

export function normalizeOptionNames(
  operation: OperationDefinition,
  options: Record<string, unknown>,
): Record<string, unknown> {
  const normalized = { ...options }
  for (const [field, optionName] of Object.entries(
    operation.cli.optionNames ?? {},
  )) {
    const optionKey = optionName.replace(
      /-([a-z])/g,
      (_match, letter: string) => letter.toUpperCase(),
    )
    if (options[optionKey] !== undefined) normalized[field] = options[optionKey]
  }
  return normalized
}

export function collectInput(
  operation: OperationDefinition,
  actionArgs: unknown[],
  options: Record<string, unknown>,
  excluded: readonly string[],
) {
  const input = collectPositionals(operation, actionArgs)

  return pickSchemaFields(operation.inputSchema, options, excluded).map(
    (fields) => Object.assign(input, fields),
  )
}

export function collectPositionals(
  operation: OperationDefinition,
  actionArgs: readonly unknown[],
): Record<string, unknown> {
  const input: Record<string, unknown> = {}
  operation.positionalArgs.forEach((argument, index) => {
    const value = actionArgs[index]
    if (value !== undefined) input[positionalName(argument)] = value
  })
  return input
}
