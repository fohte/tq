import { readFile } from 'node:fs/promises'

import { okAsync, ResultAsync } from 'neverthrow'

import { FileIoError } from '#errors'

export interface ReadableStdin {
  readonly isTTY?: boolean
  [Symbol.asyncIterator](): AsyncIterator<Buffer | string>
}

export function readContentInput(
  filePath: string | undefined,
  stdin: ReadableStdin = process.stdin,
): ResultAsync<string | undefined, FileIoError> {
  if (filePath != null) {
    return readFileContent(filePath)
  }
  if (stdin.isTTY === true) {
    return okAsync(undefined)
  }
  return ResultAsync.fromSafePromise(readStreamText(stdin))
}

function readFileContent(filePath: string): ResultAsync<string, FileIoError> {
  return ResultAsync.fromPromise(
    readFile(filePath, 'utf8'),
    (cause) => new FileIoError(`Failed to read ${filePath}`, cause),
  )
}

export function readBinaryFile(
  filePath: string,
): ResultAsync<Buffer, FileIoError> {
  return ResultAsync.fromPromise(
    readFile(filePath),
    (cause) => new FileIoError(`Failed to read ${filePath}`, cause),
  )
}

async function readStreamText(
  stream: ReadableStdin,
): Promise<string | undefined> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  if (chunks.length === 0) return undefined
  return Buffer.concat(chunks).toString('utf8')
}
