import { formatInputIssues, type OperationDefinition } from 'api/operations'
import { Command } from 'commander'

import { toApiError } from '#client'
import { buildClient, resolveWebUrl } from '#command-context'
import type { ReadableStdin } from '#input'
import { readContentInput } from '#input'
import { printOperationOutput } from '#operation-output'
import { fail } from '#result'
import {
  addSchemaOptions,
  pickSchemaFields,
  toKebabCase,
} from '#schema-options'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function positionalName(
  argument: OperationDefinition['positionalArgs'][number],
) {
  return typeof argument === 'string' ? argument : argument.name
}

function positionalSyntax(
  argument: OperationDefinition['positionalArgs'][number],
) {
  if (typeof argument === 'string') return `<${argument}>`

  const name = `${argument.name}${argument.variadic === true ? '...' : ''}`
  return argument.optional === true ? `[${name}]` : `<${name}>`
}

function operationInputError(
  operation: OperationDefinition,
  input: Record<string, unknown>,
): Error | undefined {
  const parsed = operation.inputSchema.safeParse(input)
  if (parsed.success) return undefined
  return new Error(formatInputIssues(parsed.error))
}

function renderWebPath(
  path: string,
  input: Record<string, unknown>,
): string | undefined {
  let rendered = path
  for (const match of path.matchAll(/\{([^{}]+)\}/g)) {
    const placeholder = match[0]
    const field = match[1]
    if (field == null) return undefined
    const value = input[field]
    if (typeof value !== 'string' && typeof value !== 'number') {
      return undefined
    }
    rendered = rendered.replace(placeholder, String(value))
  }
  return rendered
}

export function registerOperations(
  program: Command,
  operations: readonly OperationDefinition[],
  groupDescription: string,
  fetchImpl: typeof fetch,
  stdin: ReadableStdin,
): void {
  const cliOperations = operations.filter(
    (operation) => operation.surface?.only !== 'mcp',
  )
  const groupName = cliOperations[0]?.path[0]
  if (groupName === undefined) return
  if (cliOperations.some((operation) => operation.path[0] !== groupName)) {
    return fail(
      program,
      new Error('An operation group must contain a single root command.'),
    )
  }
  const group = program.command(groupName).description(groupDescription)

  for (const operation of cliOperations) {
    const commandPath = operation.path.slice(1)
    const commandName = commandPath.at(-1)
    if (commandName === undefined) continue

    let parent = group
    for (const part of commandPath.slice(0, -1)) {
      const existing = parent.commands.find(
        (command) => command.name() === part,
      )
      parent = existing ?? parent.command(part)
    }

    const positionals = operation.positionalArgs.map(positionalSyntax).join(' ')
    let command = parent
      .command(
        `${commandName}${positionals.length > 0 ? ` ${positionals}` : ''}`,
      )
      .description(operation.description)

    const contentInput = operation.cli.contentInput
    if (contentInput != null) {
      command = command.option(
        '--file <path>',
        'Read content from a file instead of stdin',
      )
    }

    const fileOutput =
      operation.cli.output.kind === 'json'
        ? operation.cli.output.fileOutput
        : undefined
    if (fileOutput != null) {
      command = command.option(
        `--${toKebabCase(fileOutput.option.name)} <path>`,
        fileOutput.option.description,
      )
    }

    const listOutput =
      operation.cli.output.kind === 'list' ? operation.cli.output : undefined
    if (listOutput?.fullOption != null) {
      command = command.option(
        listOutput.fullOption,
        listOutput.fullDescription ?? 'Include full output content',
      )
    }

    const excluded = [
      ...operation.positionalArgs.map(positionalName),
      ...(contentInput == null ? [] : [contentInput.field]),
    ]
    addSchemaOptions(
      command,
      operation.inputSchema,
      excluded,
      operation.cli.envDefaults,
      operation.cli.commaSeparatedOptions,
    ).match(
      () => undefined,
      (error) => fail(group, error),
    )

    command.action(async (...actionArgs: unknown[]) => {
      const commandValue = actionArgs.at(-1)
      if (!(commandValue instanceof Command)) return
      const actionCommand = commandValue
      const optionsValue = actionArgs[operation.positionalArgs.length]
      const options = isRecord(optionsValue) ? optionsValue : {}

      const input: Record<string, unknown> = {}
      operation.positionalArgs.forEach((argument, index) => {
        const value = actionArgs[index]
        if (value !== undefined) input[positionalName(argument)] = value
      })

      if (operation.cli.output.kind === 'web-url') {
        pickSchemaFields(operation.inputSchema, options, excluded).match(
          (fields) => Object.assign(input, fields),
          (error) => fail(actionCommand, error),
        )
        const inputError = operationInputError(operation, input)
        if (inputError != null) return fail(actionCommand, inputError)
        const path = renderWebPath(operation.cli.output.path, input)
        if (path == null) {
          return fail(
            actionCommand,
            new Error('Web URL path refers to a missing input field.'),
          )
        }
        const webUrl = resolveWebUrl(actionCommand).match(
          (value) => value,
          (error) => fail(actionCommand, error),
        )
        process.stdout.write(`${webUrl}${path}\n`)
        return
      }

      const client = buildClient(actionCommand, fetchImpl).match(
        (value) => value,
        (error) => fail(actionCommand, error),
      )

      pickSchemaFields(operation.inputSchema, options, excluded).match(
        (fields) => Object.assign(input, fields),
        (error) => fail(actionCommand, error),
      )

      if (contentInput != null) {
        const filePath =
          'file' in options && typeof options['file'] === 'string'
            ? options['file']
            : undefined
        const content = await readContentInput(filePath, stdin).match(
          (value) => value,
          (error) => fail(actionCommand, error),
        )
        if (content === undefined && contentInput.required !== false) {
          return fail(
            actionCommand,
            new Error(
              'Content is required. Provide --file <path> or pipe content via stdin.',
            ),
          )
        }
        if (content !== undefined) input[contentInput.field] = content
      }

      const result = await operation.run(client, input)
      if (result.isErr()) {
        switch (result.error.kind) {
          case 'input':
            return fail(actionCommand, new Error(result.error.message))
          case 'http':
            return fail(actionCommand, await toApiError(result.error.response))
          case 'request':
            return fail(actionCommand, result.error.error)
        }
      }

      const printed = await printOperationOutput(
        operation.cli.output,
        result.value,
        options,
        fetchImpl,
      )
      printed.match(
        () => undefined,
        (error) => fail(actionCommand, error),
      )
    })
  }
}
