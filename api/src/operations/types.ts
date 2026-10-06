import type { hc } from 'hono/client'
import type { Result } from 'neverthrow'
import { errAsync, okAsync, ResultAsync } from 'neverthrow'
import { z } from 'zod'

import type { AppType } from '#app'
import type { AllRoutes } from '#operations/route-types'

export type OperationClient = ReturnType<typeof hc<AppType>>

export type OperationKind = 'read' | 'write' | 'delete'

export type OperationSurface = {
  only: 'cli' | 'mcp'
  reason: string
}

export type OperationError =
  | { kind: 'input'; message: string }
  | { kind: 'http'; response: Response }
  | { kind: 'request'; error: Error }

export function omitKeyRecursively(value: unknown, key: string): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => omitKeyRecursively(item, key))
  }
  if (typeof value !== 'object' || value === null) return value

  return Object.fromEntries(
    Object.entries(value)
      .filter(([field]) => field !== key)
      .map(([field, nested]) => [field, omitKeyRecursively(nested, key)]),
  )
}

export function parseResponse<Schema extends z.ZodType>(
  schema: Schema,
  value: unknown,
) {
  const parsed = schema.safeParse(value)
  return parsed.success
    ? okAsync(parsed.data)
    : errAsync({
        kind: 'request',
        error: parsed.error,
      } satisfies OperationError)
}

export function formatInputIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.map(String).join('.') || 'input'
      return `${path}: ${issue.message}`
    })
    .join('; ')
}

export type CliFileOutput =
  | {
      kind: 'content'
      option: { name: string; description: string }
      field: string
    }
  | {
      kind: 'binary'
      option: { name: string; description: string }
      urlField: string
      summaryFields: readonly string[]
      outputPathField: string
    }

type CliListOutput = {
  kind: 'list'
  fullOption?: '--full'
  fullDescription?: string
} & (
  | { fullField: string; omitKey?: string }
  | { fullField?: undefined; omitKey: string }
)

export type CliOutput =
  | { kind: 'none' }
  | {
      kind: 'json'
      fields?: readonly string[]
      fileOutput?: CliFileOutput
    }
  | { kind: 'json-with-link-sync' }
  | CliListOutput
  | { kind: 'web-url'; path: string }

export type PositionalArgument<Key extends string = string> =
  | Key
  | {
      name: Key
      field?: undefined
      optional?: boolean
      variadic?: boolean
    }
  | {
      name: string
      field: Key
      optional?: boolean
      variadic?: boolean
    }

export type CliContentInput = {
  field: string
  required?: boolean
  fileOption?: { name: string; description: string }
}

export type CliFileInput = {
  field: string
  pathField: string
  contentTypes: Readonly<Record<string, string>>
  allowedContentTypes: readonly string[]
}

export interface OperationDefinition {
  path: readonly [rootCommand: string, ...subcommandPath: string[]]
  description: string
  inputSchema: z.ZodObject
  mcpInputSchema?: z.ZodObject
  positionalArgs: readonly PositionalArgument[]
  kind: OperationKind
  attribution?: 'agent'
  routes: readonly AllRoutes[]
  surface?: OperationSurface
  cli: {
    description?: string
    path?: readonly string[]
    group?: { description?: string; order?: number }
    commandOrder?: number
    handler?: string
    hiddenFields?: readonly string[]
    contentInput?: CliContentInput
    excludeFields?: readonly string[]
    fileInput?: CliFileInput
    envDefaults?: Readonly<Record<string, string>>
    commaSeparatedOptions?: readonly string[]
    optionNames?: Readonly<Record<string, string>>
    optionDescriptions?: Readonly<Record<string, string>>
    optionMetavars?: Readonly<Record<string, string>>
    customOptions?: readonly { flags: string; description: string }[]
    mapInput?: (
      input: Record<string, unknown>,
      options: Record<string, unknown>,
    ) => Result<Record<string, unknown>, Error>
    repeatableOptions?: readonly string[]
    optionDefaults?: Readonly<Record<string, string>>
    output: CliOutput
  }
  run: (
    client: OperationClient,
    input: unknown,
  ) => ResultAsync<unknown, OperationError>
}

type OperationConfig<Schema extends z.ZodObject, Output> = {
  path: readonly string[]
  description: string
  positionalArgs: readonly PositionalArgument<keyof z.output<Schema> & string>[]
  mcpInputSchema?: z.ZodObject
  kind: OperationKind
  attribution?: OperationDefinition['attribution']
  routes: readonly AllRoutes[]
  surface?: OperationSurface
  cli: OperationDefinition['cli']
  run: (
    client: OperationClient,
    input: z.output<Schema>,
  ) => ResultAsync<Output, OperationError>
}

export function defineOperation<
  Schema extends z.ZodObject,
  Output,
  const Definition extends OperationConfig<Schema, Output>,
>(
  inputSchema: Schema,
  definition: Definition,
): Omit<Definition, 'run'> & { inputSchema: Schema } & {
  run: (
    client: OperationClient,
    input: unknown,
  ) => ResultAsync<Output, OperationError>
} {
  return {
    ...definition,
    inputSchema,
    run(client, input) {
      const parsed = inputSchema.safeParse(input)
      if (!parsed.success) {
        return errAsync({
          kind: 'input',
          message: formatInputIssues(parsed.error),
        })
      }
      return definition.run(client, parsed.data)
    },
  }
}

function toRequestError(cause: unknown): OperationError {
  return {
    kind: 'request',
    error: cause instanceof Error ? cause : new Error(String(cause)),
  }
}

export function requestJson<ResponseType extends Response>(
  request: Promise<ResponseType>,
): ResultAsync<unknown, OperationError> {
  return ResultAsync.fromPromise(request, toRequestError).andThen(
    (response) => {
      if (!response.ok) {
        return errAsync({ kind: 'http', response } satisfies OperationError)
      }
      return ResultAsync.fromPromise(response.json(), toRequestError)
    },
  )
}

export function requestNoContent<ResponseType extends Response>(
  request: Promise<ResponseType>,
): ResultAsync<undefined, OperationError> {
  return ResultAsync.fromPromise(request, toRequestError).andThen<
    undefined,
    OperationError
  >((response) =>
    response.ok
      ? ResultAsync.fromSafePromise(Promise.resolve(undefined))
      : errAsync({ kind: 'http', response } satisfies OperationError),
  )
}
