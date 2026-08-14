function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const numericRefPattern = /^\d+$/

// A ref matched under `resource`, already split into a numeric task number
// or an opaque id (e.g. a UUID) so callers don't need to re-parse the
// captured string themselves.
export type AppResourceRef =
  | { resource: string; kind: 'number'; value: number }
  | { resource: string; kind: 'id'; value: string }

// Extracts the id-or-number segment from tq URLs under `resource` (e.g.
// `https://tq.fohte.net/tasks/123` or `.../tasks/<uuid>`), so callers can
// resolve them the same way as a `#123`-style mention. A trailing
// path/query/fragment (e.g. `/tasks/123/pages/abc`) is ignored, and trailing
// prose punctuation (e.g. a sentence-ending period) is excluded, since the
// capture stops at the first character outside `[0-9a-zA-Z-]`. Repeated refs
// to the same id are deduped.
export function extractAppResourceRefs(
  text: string,
  appDomain: string,
  resource: string,
): AppResourceRef[] {
  const pattern = new RegExp(
    `https?://${escapeRegExp(appDomain)}/${escapeRegExp(resource)}/([0-9a-zA-Z-]+)`,
    'g',
  )
  const refs = new Set<string>()
  for (const match of text.matchAll(pattern)) {
    const ref = match[1]
    if (ref != null) refs.add(ref)
  }
  return [...refs].map((ref) =>
    numericRefPattern.test(ref)
      ? { resource, kind: 'number' as const, value: Number(ref) }
      : { resource, kind: 'id' as const, value: ref },
  )
}
