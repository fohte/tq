import type { hc } from 'hono/client'
import { errAsync, ResultAsync } from 'neverthrow'
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

export type CliOutput =
  | {
      kind: 'json'
      fields?: readonly string[]
      fileOutput?: CliFileOutput
    }
  | { kind: 'json-with-link-sync' }
  | {
      kind: 'list'
      omitKey: string
      fullOption?: '--full'
      fullDescription?: string
    }
  | { kind: 'web-url'; path: string }

export type PositionalArgument<Key extends string = string> =
  Key | { name: Key; optional?: boolean; variadic?: boolean }

export type CliContentInput = {
  field: string
  required?: boolean
}

export interface OperationDefinition {
  path: readonly [group: string, command: string, ...nestedPath: string[]]
  description: string
  inputSchema: z.ZodObject
  positionalArgs: readonly PositionalArgument[]
  kind: OperationKind
  routes: readonly AllRoutes[]
  surface?: OperationSurface
  cli: {
    contentInput?: CliContentInput
    envDefaults?: Readonly<Record<string, string>>
    commaSeparatedOptions?: readonly string[]
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
  kind: OperationKind
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
