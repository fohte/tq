import { err, ok, type Result } from 'neverthrow'

/**
 * Extract the first element from a Drizzle `.returning()` result,
 * throwing if the array is empty.
 */
export function firstOrThrow<T>(rows: T[]): T {
  const first = rows[0]
  if (first === undefined) {
    throw new Error('Expected at least one row from returning(), got none')
  }
  return first
}

export class RowNotFoundError extends Error {
  constructor() {
    super('Expected at least one row from returning(), got none')
    this.name = 'RowNotFoundError'
  }
}

/**
 * Result-returning counterpart of `firstOrThrow`, for callers outside the
 * throw-permitted boundary layer.
 */
export function firstOrErr<T>(rows: T[]): Result<T, RowNotFoundError> {
  const first = rows[0]
  return first === undefined ? err(new RowNotFoundError()) : ok(first)
}
