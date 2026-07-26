import { err, ok, type Result } from 'neverthrow'

/**
 * Extract the first element from a Drizzle `.returning()` result,
 * throwing if the array is empty.
 */
export function firstOrThrow<T>(rows: T[]): T {
  const first = rows[0]
  if (first === undefined) {
    // eslint-disable-next-line no-restricted-syntax -- still depended on by routes outside the Result-returning boundary; firstOrErr is the counterpart for migrated callers
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
 * Result-returning counterpart of `firstOrThrow`, for callers migrated to
 * neverthrow's `Result`.
 */
export function firstOrErr<T>(rows: T[]): Result<T, RowNotFoundError> {
  const first = rows[0]
  return first === undefined ? err(new RowNotFoundError()) : ok(first)
}
