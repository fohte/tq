export const numericIdPattern = /^\d+$/

// `tasks.number` is a Postgres `integer`; comparing/inserting a digit string
// past this range would make an `eq`/`inArray` query throw instead of simply
// matching nothing.
const PG_INTEGER_MAX = 2147483647

export type NumericOrId =
  { kind: 'number'; value: number } | { kind: 'id'; value: string }

// Classifies an id-like string — a `/tasks/<id-or-number>` URL segment or a
// route param — as either a Postgres-safe integer or an opaque id such as a
// UUID. Not used for `#123`-style mentions: `extractMentionedNumbers` parses
// those digits directly and does not go through this guard.
export function classifyNumericOrId(value: string): NumericOrId {
  return numericIdPattern.test(value) && Number(value) <= PG_INTEGER_MAX
    ? { kind: 'number', value: Number(value) }
    : { kind: 'id', value }
}
