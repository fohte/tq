import type { hc } from 'hono/client'
import { errAsync, ResultAsync } from 'neverthrow'
import { z } from 'zod'

import type { AppType } from '#app'
import type { AllRoutes } from '#operations/route-types'

export type OperationClient = ReturnType<typeof hc<AppType>>

export type OperationKind = 'read' | 'write' | 'delete'

export type OperationError =
  | { kind: 'input'; message: string }
  | { kind: 'http'; response: Response }
  | { kind: 'request'; error: Error }

export type CliOutput =
  | { kind: 'json' }
  | { kind: 'json-with-link-sync' }
  | {
      kind: 'list'
      omitKey: string
      fullOption?: string
      fullDescription?: string
    }

export interface OperationDefinition {
  path: readonly string[]
  description: string
  inputSchema: z.ZodObject
  positionalArgs: readonly string[]
  kind: OperationKind
  routes: readonly AllRoutes[]
  cli: {
    contentInputField?: string
    contentRequiredMessage?: string
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
  positionalArgs: readonly (keyof z.output<Schema> & string)[]
  kind: OperationKind
  routes: readonly AllRoutes[]
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
          message: parsed.error.issues[0]?.message ?? 'Invalid input',
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
