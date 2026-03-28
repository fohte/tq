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
