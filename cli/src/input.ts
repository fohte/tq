import { readFile } from 'node:fs/promises'

import { FileIoError } from '#errors'

export async function readContentInput(
  filePath: string | undefined,
  stdin: NodeJS.ReadStream = process.stdin,
): Promise<string | undefined> {
  if (filePath != null) {
    return readFileContent(filePath)
  }
  if (stdin.isTTY) {
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

async function readStreamText(
  stream: NodeJS.ReadableStream,
): Promise<string | undefined> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  if (chunks.length === 0) return undefined
  return Buffer.concat(chunks).toString('utf8')
}
