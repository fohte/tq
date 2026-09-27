import { basename, extname } from 'node:path'

import {
  formatInputIssues,
  type OperationClient,
  type OperationDefinition,
} from 'api/operations'
import { Command } from 'commander'
import { err, ok, type Result } from 'neverthrow'

import { toApiError } from '#client'
import { buildClient, resolveWebUrl } from '#command-context'
import type { ReadableStdin } from '#input'
import { readBinaryFile, readContentInput } from '#input'
import {
  collectInput,
  collectPositionals,
  normalizeOptionNames,
  positionalName,
  positionalSyntax,
} from '#operation-input'
import { getOrderedOperationGroups } from '#operation-order'
import { printOperationOutput } from '#operation-output'
import { fail } from '#result'
import { addSchemaOptions, toKebabCase } from '#schema-options'

export type OperationCommandContext = {
  options: Record<string, unknown>
  input: Record<string, unknown>
  stdin: ReadableStdin
  execute: (
    input:
      Record<string, unknown> | (() => Result<Record<string, unknown>, Error>),
    options?: { ignoreErrors?: boolean },
  ) => Promise<void>
}

export type OperationCommandHandler = (
  context: OperationCommandContext,
) => Promise<void>

export type OperationCommandHandlers = Readonly<
  Record<string, OperationCommandHandler>
>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function mapCliInput(
  operation: OperationDefinition,
  input: Record<string, unknown>,
  options: Record<string, unknown>,
): Result<Record<string, unknown>, Error> {
  return operation.cli.mapInput?.(input, options) ?? ok(input)
}

function operationInputError(
  operation: OperationDefinition,
  input: Record<string, unknown>,
): Error | undefined {
  const parsed = operation.inputSchema.safeParse(input)
  if (parsed.success) return undefined
  return new Error(formatInputIssues(parsed.error))
}

function reportError(
  actionCommand: Command,
  error: Error,
  ignoreErrors: boolean,
): void {
  if (!ignoreErrors) fail(actionCommand, error)
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

function printWebUrl(
  actionCommand: Command,
  output: Extract<OperationDefinition['cli']['output'], { kind: 'web-url' }>,
  input: Record<string, unknown>,
): Result<void, Error> {
  const path = renderWebPath(output.path, input)
  if (path == null) {
    return err(new Error('Web URL path refers to a missing input field.'))
  }
  return resolveWebUrl(actionCommand).map((webUrl) => {
    process.stdout.write(`${webUrl}${path}\n`)
  })
}

type OperationInput =
  Record<string, unknown> | (() => Result<Record<string, unknown>, Error>)

async function executeOperation(
  operation: OperationDefinition,
  output: Exclude<OperationDefinition['cli']['output'], { kind: 'web-url' }>,
  actionCommand: Command,
  options: Record<string, unknown>,
  client: OperationClient,
  input: Record<string, unknown>,
  fetchImpl: typeof fetch,
  ignoreErrors: boolean,
): Promise<void> {
  const result = await operation.run(client, input)
  if (result.isErr()) {
    const operationError = result.error
    const error =
      operationError.kind === 'input'
        ? new Error(operationError.message)
        : operationError.kind === 'http'
          ? await toApiError(operationError.response)
          : operationError.error
    reportError(actionCommand, error, ignoreErrors)
    return
  }

  const printed = await printOperationOutput(
    output,
    result.value,
    options,
    fetchImpl,
  )
  if (printed.isErr()) reportError(actionCommand, printed.error, ignoreErrors)
}

async function executeCommandOperation(
  operation: OperationDefinition,
  actionCommand: Command,
  options: Record<string, unknown>,
  fetchImpl: typeof fetch,
  stdin: ReadableStdin,
  input: OperationInput,
  { ignoreErrors = false }: { ignoreErrors?: boolean } = {},
): Promise<void> {
  const resolveInput = () => {
    const collected = typeof input === 'function' ? input() : ok(input)
    return collected.andThen((value) => mapCliInput(operation, value, options))
  }
  const output = operation.cli.output

  if (output.kind === 'web-url') {
    const collected = resolveInput()
    if (collected.isErr()) {
      reportError(actionCommand, collected.error, ignoreErrors)
      return
    }
    const inputError = operationInputError(operation, collected.value)
    if (inputError != null) {
      reportError(actionCommand, inputError, ignoreErrors)
      return
    }
    const printed = printWebUrl(actionCommand, output, collected.value)
    if (printed.isErr()) reportError(actionCommand, printed.error, ignoreErrors)
    return
  }

  const clientResult = buildClient(actionCommand, fetchImpl)
  if (clientResult.isErr()) {
    reportError(actionCommand, clientResult.error, ignoreErrors)
    return
  }

  const collected = resolveInput()
  if (collected.isErr()) {
    reportError(actionCommand, collected.error, ignoreErrors)
    return
  }
  const inputValue = collected.value

  const listOutput = output.kind === 'list' ? output : undefined
  if (listOutput?.fullField != null && options['full'] === true) {
    inputValue[listOutput.fullField] = true
  }

  const contentInput = operation.cli.contentInput
  if (contentInput != null) {
    const filePath =
      'file' in options && typeof options['file'] === 'string'
        ? options['file']
        : undefined
    const content = await readContentInput(filePath, stdin)
    if (content.isErr()) {
      reportError(actionCommand, content.error, ignoreErrors)
      return
    }
    if (content.value === undefined && contentInput.required !== false) {
      reportError(
        actionCommand,
        new Error(
          'Content is required. Provide --file <path> or pipe content via stdin.',
        ),
        ignoreErrors,
      )
      return
    }
    if (content.value !== undefined) {
      inputValue[contentInput.field] = content.value
    }
  }

  const fileInput = operation.cli.fileInput
  if (fileInput != null) {
    const filePath: unknown = inputValue[fileInput.pathField]
    if (typeof filePath !== 'string') {
      reportError(
        actionCommand,
        new Error('File input path refers to a missing input field.'),
        ignoreErrors,
      )
      return
    }

    const data = await readBinaryFile(filePath)
    if (data.isErr()) {
      reportError(actionCommand, data.error, ignoreErrors)
      return
    }

    const contentType = fileInput.contentTypes[extname(filePath).toLowerCase()]
    if (contentType == null) {
      reportError(
        actionCommand,
        new Error(
          `Unsupported file extension for ${filePath}. Allowed types: ${fileInput.allowedContentTypes.join(', ')}`,
        ),
        ignoreErrors,
      )
      return
    }

    inputValue[fileInput.field] = new File([data.value], basename(filePath), {
      type: contentType,
    })
  }

  await executeOperation(
    operation,
    output,
    actionCommand,
    options,
    clientResult.value,
    inputValue,
    fetchImpl,
    ignoreErrors,
  )
}

export function registerOperations(
  program: Command,
  operations: readonly OperationDefinition[],
  fetchImpl: typeof fetch,
  stdin: ReadableStdin,
  handlers: OperationCommandHandlers = {},
): void {
  for (const {
    groupName,
    groupOperations,
    groupDescription,
  } of getOrderedOperationGroups(operations)) {
    if (groupDescription == null) continue

    const group = program.command(groupName).description(groupDescription)
    registerOperationsInGroup(
      group,
      groupOperations,
      fetchImpl,
      stdin,
      handlers,
    )
  }
}

function registerOperationsInGroup(
  group: Command,
  operations: readonly OperationDefinition[],
  fetchImpl: typeof fetch,
  stdin: ReadableStdin,
  handlers: OperationCommandHandlers,
): void {
  const cliOperations = operations.filter(
    (operation) => operation.surface?.only !== 'mcp',
  )
  if (
    cliOperations.some(
      (operation) => (operation.cli.path ?? operation.path)[0] !== group.name(),
    )
  ) {
    return fail(
      group,
      new Error('An operation group must contain a single root command.'),
    )
  }

  for (const operation of cliOperations) {
    const handlerKey = operation.cli.handler
    const handler = handlerKey == null ? undefined : handlers[handlerKey]
    if (handlerKey != null && handler == null) {
      return fail(
        group,
        new Error(`No CLI handler is registered for "${handlerKey}".`),
      )
    }

    const commandPath = (operation.cli.path ?? operation.path).slice(1)
    const positionals = operation.positionalArgs.map(positionalSyntax).join(' ')
    let command = group
    if (commandPath.length === 0) {
      for (const positional of operation.positionalArgs) {
        command = command.argument(positionalSyntax(positional))
      }
      command.description(operation.cli.description ?? operation.description)
    } else {
      const commandName = commandPath.at(-1)
      if (commandName === undefined) continue
      for (const part of commandPath.slice(0, -1)) {
        const existing = command.commands.find(
          (candidate) => candidate.name() === part,
        )
        command = existing ?? command.command(part)
      }
      command = command
        .command(
          `${commandName}${positionals.length > 0 ? ` ${positionals}` : ''}`,
        )
        .description(operation.cli.description ?? operation.description)
    }

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

    for (const option of operation.cli.customOptions ?? []) {
      command = command.option(option.flags, option.description)
    }

    const excluded = [
      ...operation.positionalArgs.map(positionalName),
      ...(operation.cli.hiddenFields ?? []),
      ...(contentInput == null ? [] : [contentInput.field]),
      ...(operation.cli.excludeFields ?? []),
      ...(listOutput?.fullField == null ? [] : [listOutput.fullField]),
      ...(operation.cli.fileInput == null
        ? []
        : [operation.cli.fileInput.field]),
    ]
    addSchemaOptions(command, operation.inputSchema, {
      exclude: excluded,
      ...(operation.cli.envDefaults == null
        ? {}
        : { envDefaults: operation.cli.envDefaults }),
      ...(operation.cli.commaSeparatedOptions == null
        ? {}
        : { commaSeparatedOptions: operation.cli.commaSeparatedOptions }),
      ...(operation.cli.repeatableOptions == null
        ? {}
        : { repeatableOptions: operation.cli.repeatableOptions }),
      ...(operation.cli.optionDefaults == null
        ? {}
        : { optionDefaults: operation.cli.optionDefaults }),
      ...(operation.cli.optionNames == null
        ? {}
        : { optionNames: operation.cli.optionNames }),
      ...(operation.cli.optionDescriptions == null
        ? {}
        : { optionDescriptions: operation.cli.optionDescriptions }),
      ...(operation.cli.optionMetavars == null
        ? {}
        : { optionMetavars: operation.cli.optionMetavars }),
    }).match(
      () => undefined,
      (error) => fail(group, error),
    )

    command.action(async (...actionArgs: unknown[]) => {
      const commandValue = actionArgs.at(-1)
      if (!(commandValue instanceof Command)) return
      const actionCommand = commandValue
      const optionsValue = actionArgs[operation.positionalArgs.length]
      const options = normalizeOptionNames(
        operation,
        isRecord(optionsValue) ? optionsValue : {},
      )
      const collected = collectInput(operation, actionArgs, options, excluded)

      if (handler != null) {
        await handler({
          options,
          input: collected.isOk()
            ? collected.value
            : collectPositionals(operation, actionArgs),
          stdin,
          execute: (input, runOptions) =>
            executeCommandOperation(
              operation,
              actionCommand,
              options,
              fetchImpl,
              stdin,
              input,
              runOptions,
            ),
        })
        return
      }

      await executeCommandOperation(
        operation,
        actionCommand,
        options,
        fetchImpl,
        stdin,
        () => collected,
      )
    })
  }
}
