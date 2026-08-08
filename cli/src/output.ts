import { writeFile } from 'node:fs/promises'

import { FileIoError } from '#errors'

export function printJson(data: unknown): void {
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`)
}

export async function writeContentFile(
  filePath: string,
  content: string,
): Promise<void> {
  try {
    await writeFile(filePath, content, 'utf8')
  } catch (cause) {
    throw new FileIoError(`Failed to write ${filePath}`, cause)
  }
}

export async function writeBinaryFile(
  filePath: string,
  data: Uint8Array,
): Promise<void> {
  try {
    await writeFile(filePath, data)
  } catch (cause) {
    throw new FileIoError(`Failed to write ${filePath}`, cause)
  }
}
