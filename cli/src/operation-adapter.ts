import type { OperationDefinition } from 'api/operations'
import { Command } from 'commander'

import { toApiError } from '#client'
import { buildClient } from '#command-context'
import type { ReadableStdin } from '#input'
import { readContentInput } from '#input'
import {
  printJson,
  printJsonList,
  printOperationJsonWithLinkSync,
} from '#output'
import { fail } from '#result'
import { addSchemaOptions, pickSchemaFields } from '#schema-options'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function registerOperations(
  program: Command,
  operations: readonly [OperationDefinition, ...OperationDefinition[]],
  groupDescription: string,
  fetchImpl: typeof fetch,
  stdin: ReadableStdin,
): void {
  const groupName = operations[0].path[0]
  if (operations.some((operation) => operation.path[0] !== groupName)) {
    return fail(
      program,
      new Error('An operation group must contain a single root command.'),
    )
  }
  const group = program.command(groupName).description(groupDescription)

  for (const operation of operations) {
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

    const positionals = operation.positionalArgs
      .map((argument) => `<${argument}>`)
      .join(' ')
    let command = parent
      .command(
        `${commandName}${positionals.length > 0 ? ` ${positionals}` : ''}`,
      )
      .description(operation.description)

    if (operation.cli.contentInputField != null) {
      command = command.option(
        '--file <path>',
        'Read content from a file instead of stdin',
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
      ...operation.positionalArgs,
      ...(operation.cli.contentInputField == null
        ? []
        : [operation.cli.contentInputField]),
    ]
    addSchemaOptions(command, operation.inputSchema, excluded).match(
      () => undefined,
      (error) => fail(group, error),
    )

    command.action(async (...actionArgs: unknown[]) => {
      const commandValue = actionArgs.at(-1)
      if (!(commandValue instanceof Command)) return
      const actionCommand = commandValue
      const optionsValue = actionArgs[operation.positionalArgs.length]
      const options = isRecord(optionsValue) ? optionsValue : {}

      const client = buildClient(actionCommand, fetchImpl).match(
        (value) => value,
        (error) => fail(actionCommand, error),
      )

      const input: Record<string, unknown> = {}
      operation.positionalArgs.forEach((argument, index) => {
        input[argument] = actionArgs[index]
      })

      pickSchemaFields(operation.inputSchema, options, excluded).match(
        (fields) => Object.assign(input, fields),
        (error) => fail(actionCommand, error),
      )

      const contentField = operation.cli.contentInputField
      if (contentField != null) {
        const filePath =
          'file' in options && typeof options['file'] === 'string'
            ? options['file']
            : undefined
        const content = await readContentInput(filePath, stdin).match(
          (value) => value,
          (error) => fail(actionCommand, error),
        )
        if (content === undefined) {
          return fail(
            actionCommand,
            new Error(
              'Content is required. Provide --file <path> or pipe content via stdin.',
            ),
          )
        }
        input[contentField] = content
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

      switch (operation.cli.output.kind) {
        case 'json':
          printJson(result.value)
          break
        case 'json-with-link-sync':
          printOperationJsonWithLinkSync(result.value).match(
            () => undefined,
            (error) => fail(actionCommand, error),
          )
          break
        case 'list': {
          const full = options['full'] === true
          printJsonList(result.value, operation.cli.output.omitKey, { full })
          break
        }
      }
    })
  }
}
