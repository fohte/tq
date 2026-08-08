import { readFile } from 'node:fs/promises'

import { FileIoError } from '#errors'

export interface ReadableStdin {
  readonly isTTY?: boolean
  [Symbol.asyncIterator](): AsyncIterator<Buffer | string>
}

export async function readContentInput(
  filePath: string | undefined,
  stdin: ReadableStdin = process.stdin,
): Promise<string | undefined> {
  if (filePath != null) {
    return readFileContent(filePath)
  }
  if (stdin.isTTY === true) {
    return undefined
  }
  return readStreamText(stdin)
}

async function readFileContent(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, 'utf8')
  } catch (cause) {
    throw new FileIoError(`Failed to read ${filePath}`, cause)
  }
}

export async function readBinaryFile(filePath: string): Promise<Buffer> {
  try {
    return await readFile(filePath)
  } catch (cause) {
    throw new FileIoError(`Failed to read ${filePath}`, cause)
  }
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
