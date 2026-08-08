import { writeFile } from 'node:fs/promises'

import { FileIoError } from '#errors'

export function printJson(data: unknown): void {
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`)
}

function omitDeep(value: unknown, key: string): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => omitDeep(item, key))
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([k]) => k !== key)
        .map(([k, v]) => [k, omitDeep(v, key)]),
    )
  }
  return value
}

/**
 * Prints a list response as JSON, omitting `omitKey` (a long-text field
 * like `content`/`description`) from every item unless `full` is set —
 * keeps list output from flooding stdout with full page/comment bodies.
 */
export function printJsonList(
  data: unknown,
  omitKey: string,
  { full = false }: { full?: boolean | undefined } = {},
): void {
  printJson(full ? data : omitDeep(data, omitKey))
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
