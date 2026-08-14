import {
  type Column,
  type ColumnBaseConfig,
  inArray,
  or,
  type SQL,
  sql,
} from 'drizzle-orm'
import { err, ok, type Result } from 'neverthrow'

import type { NumericOrId } from '#lib/numeric-id'

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

/**
 * Match any row of `table` whose id/number column value appears in `refs`
 * (the Rails-`scope`-like counterpart to `classifyNumericOrId`). `number` is
 * optional since not every id-or-number-linkable table has a human-facing
 * number column (e.g. projects, addressed by id only). Falls back to
 * `sql\`false\`` (matching nothing) for an empty `refs`, since an empty
 * `or()` resolves to `undefined` and an `undefined` WHERE clause would match
 * every row instead.
 */
export function matchByIdOrNumber(
  table: {
    id: Column<ColumnBaseConfig<'string', string>>
    number?: Column<ColumnBaseConfig<'number', string>>
  },
  refs: NumericOrId[],
): SQL {
  const numbers = refs
    .filter((ref) => ref.kind === 'number')
    .map((ref) => ref.value)
  const ids = refs.filter((ref) => ref.kind === 'id').map((ref) => ref.value)
  return (
    or(
      table.number && numbers.length > 0
        ? inArray(table.number, numbers)
        : undefined,
      ids.length > 0 ? inArray(table.id, ids) : undefined,
    ) ?? sql`false`
  )
}
