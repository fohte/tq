import type { CliOutput } from 'api/operations'
import { err, errAsync, ok, Result, ResultAsync } from 'neverthrow'

import { toApiError } from '#client'
import {
  printJson,
  printJsonList,
  printOperationJsonWithLinkSync,
  writeBinaryFile,
  writeContentFile,
} from '#output'

type JsonOutput = Extract<CliOutput, { kind: 'json' }>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function errorFromCause(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause))
}

function requiredStringField(
  value: unknown,
  field: string,
): Result<{ record: Record<string, unknown>; value: string }, Error> {
  if (!isRecord(value) || typeof value[field] !== 'string') {
    return err(
      new Error(`Operation response must contain string field "${field}".`),
    )
  }
  return ok({ record: value, value: value[field] })
}

function selectRecordFields(
  value: Record<string, unknown>,
  fields: readonly string[],
): Record<string, unknown> {
  return Object.fromEntries(
    fields.flatMap((field) => (field in value ? [[field, value[field]]] : [])),
  )
}

function selectFields(value: unknown, fields: readonly string[]): unknown {
  return isRecord(value) ? selectRecordFields(value, fields) : value
}

function fetchBinary(
  url: string,
  fetchImpl: typeof fetch,
): ResultAsync<Uint8Array, Error> {
  return ResultAsync.fromPromise(fetchImpl(url), errorFromCause).andThen(
    (response) => {
      if (!response.ok) {
        return ResultAsync.fromPromise(
          toApiError(response),
          errorFromCause,
        ).andThen((error) => errAsync<Uint8Array, Error>(error))
      }
      return ResultAsync.fromPromise(
        response.arrayBuffer(),
        errorFromCause,
      ).map((buffer) => new Uint8Array(buffer))
    },
  )
}

async function printJsonOutput(
  output: JsonOutput,
  value: unknown,
  options: Record<string, unknown>,
  fetchImpl: typeof fetch,
): Promise<Result<void, Error>> {
  const fileOutput = output.fileOutput
  const filePath =
    fileOutput == null ? undefined : options[fileOutput.option.name]
  if (fileOutput == null || typeof filePath !== 'string') {
    printJson(
      output.fields == null ? value : selectFields(value, output.fields),
    )
    return ok(undefined)
  }

  if (fileOutput.kind === 'content') {
    const content = requiredStringField(value, fileOutput.field)
    if (content.isErr()) return err(content.error)

    const written = await writeContentFile(filePath, content.value.value)
    if (written.isErr()) return err(written.error)
    printJson(
      Object.fromEntries(
        Object.entries(content.value.record).filter(
          ([key]) => key !== fileOutput.field,
        ),
      ),
    )
    return ok(undefined)
  }

  const url = requiredStringField(value, fileOutput.urlField)
  if (url.isErr()) return err(url.error)

  const binary = await fetchBinary(url.value.value, fetchImpl)
  if (binary.isErr()) return err(binary.error)

  const written = await writeBinaryFile(filePath, binary.value)
  if (written.isErr()) return err(written.error)
  printJson({
    ...selectRecordFields(url.value.record, fileOutput.summaryFields),
    [fileOutput.outputPathField]: filePath,
  })
  return ok(undefined)
}

export async function printOperationOutput(
  output: Exclude<CliOutput, { kind: 'web-url' }>,
  value: unknown,
  options: Record<string, unknown>,
  fetchImpl: typeof fetch,
): Promise<Result<void, Error>> {
  switch (output.kind) {
    case 'json':
      return printJsonOutput(output, value, options, fetchImpl)
    case 'json-with-link-sync':
      return printOperationJsonWithLinkSync(value)
    case 'list':
      printJsonList(value, output.omitKey, { full: options['full'] === true })
      return ok(undefined)
  }
}
