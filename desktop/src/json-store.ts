import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

import { Result } from 'neverthrow'

export type JsonStoreStorage = {
  read: () => string
  write: (serialized: string) => void
}

export type JsonStore<T> = {
  load: () => Result<T | undefined, unknown>
  save: (value: T) => Result<void, unknown>
}

export const createJsonFileStorage = (filePath: string): JsonStoreStorage => ({
  read: () => readFileSync(filePath, 'utf8'),
  write: (serialized) => {
    mkdirSync(dirname(filePath), { recursive: true })
    writeFileSync(filePath, serialized)
  },
})

export const createJsonStore = <T>(
  { read, write }: JsonStoreStorage,
  parseValue: (value: unknown) => T | undefined,
): JsonStore<T> => {
  const parse = Result.fromThrowable(
    (serialized: string): unknown => JSON.parse(serialized),
    (caughtErr) => caughtErr,
  )

  return {
    load: () =>
      Result.fromThrowable(read, (caughtErr) => caughtErr)().andThen(
        (serialized) => parse(serialized).map(parseValue),
      ),
    save: (value) =>
      Result.fromThrowable(
        () => {
          write(JSON.stringify(value))
        },
        (caughtErr) => caughtErr,
      )(),
  }
}
