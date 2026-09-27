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
import { printOperationOutput } from '#operation-output'
import { fail } from '#result'
import {
  addSchemaOptions,
  pickSchemaFields,
  toKebabCase,
} from '#schema-options'

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function positionalName(
  argument: OperationDefinition['positionalArgs'][number],
) {
  return typeof argument === 'string'
    ? argument
    : (argument.field ?? argument.name)
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

function collectInput(
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

function collectPositionals(
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
    if (!ignoreErrors) fail(actionCommand, error)
    return
  }

  if (operation.cli.output.kind === 'web-url') {
    const printed = printWebUrl(actionCommand, operation.cli.output, input)
    if (printed.isErr() && !ignoreErrors) fail(actionCommand, printed.error)
    return
  }

  const printed = await printOperationOutput(
    operation.cli.output,
    result.value,
    options,
    fetchImpl,
  )
  if (printed.isErr() && !ignoreErrors) fail(actionCommand, printed.error)
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
  const resolveInput = () => (typeof input === 'function' ? input() : ok(input))

  if (operation.cli.output.kind === 'web-url') {
    const collected = resolveInput()
    if (collected.isErr()) {
      if (!ignoreErrors) fail(actionCommand, collected.error)
      return
    }
    const inputError = operationInputError(operation, collected.value)
    if (inputError != null) {
      if (!ignoreErrors) fail(actionCommand, inputError)
      return
    }
    const printed = printWebUrl(
      actionCommand,
      operation.cli.output,
      collected.value,
    )
    if (printed.isErr() && !ignoreErrors) fail(actionCommand, printed.error)
    return
  }

  const clientResult = buildClient(actionCommand, fetchImpl)
  if (clientResult.isErr()) {
    if (!ignoreErrors) fail(actionCommand, clientResult.error)
    return
  }

  const collected = resolveInput()
  if (collected.isErr()) {
    if (!ignoreErrors) fail(actionCommand, collected.error)
    return
  }
  const inputValue = collected.value

  const listOutput =
    operation.cli.output.kind === 'list' ? operation.cli.output : undefined
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
      if (!ignoreErrors) fail(actionCommand, content.error)
      return
    }
    if (content.value === undefined && contentInput.required !== false) {
      if (!ignoreErrors) {
        fail(
          actionCommand,
          new Error(
            'Content is required. Provide --file <path> or pipe content via stdin.',
          ),
        )
      }
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
      if (!ignoreErrors) {
        fail(
          actionCommand,
          new Error('File input path refers to a missing input field.'),
        )
      }
      return
    }

    const data = await readBinaryFile(filePath)
    if (data.isErr()) {
      if (!ignoreErrors) fail(actionCommand, data.error)
      return
    }

    const contentType = fileInput.contentTypes[extname(filePath).toLowerCase()]
    if (contentType == null) {
      if (!ignoreErrors) {
        fail(
          actionCommand,
          new Error(
            `Unsupported file extension for ${filePath}. Allowed types: ${fileInput.allowedContentTypes.join(', ')}`,
          ),
        )
      }
      return
    }

    inputValue[fileInput.field] = new File([data.value], basename(filePath), {
      type: contentType,
    })
  }

  await executeOperation(
    operation,
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
  groupDescription: string,
  fetchImpl: typeof fetch,
  stdin: ReadableStdin,
  handler?: OperationCommandHandler,
): void {
  const cliOperations = operations.filter(
    (operation) => operation.surface?.only !== 'mcp',
  )
  const groupName = (cliOperations[0]?.cli.path ?? cliOperations[0]?.path)?.[0]
  if (groupName === undefined) return
  const group = program.command(groupName).description(groupDescription)

  registerOperationsInGroup(group, operations, fetchImpl, stdin, handler)
}

export function registerOperationsInGroup(
  group: Command,
  operations: readonly OperationDefinition[],
  fetchImpl: typeof fetch,
  stdin: ReadableStdin,
  handler?: OperationCommandHandler,
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
    const commandPath = (operation.cli.path ?? operation.path).slice(1)
    const positionals = operation.positionalArgs.map(positionalSyntax).join(' ')
    let command = group
    if (commandPath.length === 0) {
      for (const positional of operation.positionalArgs) {
        command = command.argument(positionalSyntax(positional))
      }
      command.description(operation.description)
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
        .description(operation.description)
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

    const excluded = [
      ...operation.positionalArgs.map(positionalName),
      ...(operation.cli.hiddenFields ?? []),
      ...(contentInput == null ? [] : [contentInput.field]),
      ...(listOutput?.fullField == null ? [] : [listOutput.fullField]),
      ...(operation.cli.fileInput == null
        ? []
        : [operation.cli.fileInput.field]),
    ]
    addSchemaOptions(
      command,
      operation.inputSchema,
      excluded,
      operation.cli.envDefaults,
      {
        commaSeparated: operation.cli.commaSeparatedOptions ?? [],
        repeatable: operation.cli.repeatableOptions ?? [],
        defaults: operation.cli.optionDefaults ?? {},
      },
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
