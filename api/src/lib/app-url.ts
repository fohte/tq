import { classifyNumericOrId, type NumericOrId } from '#lib/numeric-id'

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export interface AppResourceUrlMatch {
  /** Start offset of the matched URL within `text`, inclusive. */
  start: number
  /** End offset of the matched URL within `text`, exclusive. */
  end: number
  /** The full matched URL text (including an optional trailing slash). */
  raw: string
  /** The captured id-or-number segment, e.g. `123` or a uuid. */
  id: string
}

// Matches `https?://<host>/<resource>/<id>` URLs in free text and captures
// the id segment. A trailing path segment (`/tasks/123/pages/abc`) or a
// trailing underscore (`/tasks/123abc_`, the only word character not already
// absorbed into the id by `[0-9a-zA-Z-]+`) excludes the whole match, since
// the URL then points at something more specific than the resource itself; a
// trailing query string, fragment, or single optional slash does not. Callers
// decide what to do with the raw matches themselves (dedup, classify the id,
// place editor widgets, ...) since that differs per call site — `web`'s
// task-url/project-url providers call this directly (via the `api` package's
// `./lib/app-url` export) with `window.location.host` as a client-side
// pre-filter, then hand the extracted id to the existing
// `GET /api/tasks/:id` / `GET /api/projects/:id` endpoints, which resolve by
// id alone with no domain check.
export function matchAppResourceUrls(
  text: string,
  host: string,
  resource: string,
): AppResourceUrlMatch[] {
  const pattern = new RegExp(
    `https?://${escapeRegExp(host)}/${escapeRegExp(resource)}/([0-9a-zA-Z-]+)/?(?![\\w/-])`,
    'g',
  )
  const matches: AppResourceUrlMatch[] = []
  for (const match of text.matchAll(pattern)) {
    const id = match[1]
    if (id == null) continue
    matches.push({
      start: match.index,
      end: match.index + match[0].length,
      raw: match[0],
      id,
    })
  }
  return matches
}

// A ref matched under `resource`, already split into a numeric task number
// or an opaque id (e.g. a UUID) so callers don't need to re-parse the
// captured string themselves.
export type AppResourceRef = { resource: string } & NumericOrId

// Extracts the id-or-number segment from tq URLs under `resource` (e.g.
// `https://tq.fohte.net/tasks/123` or `.../tasks/<uuid>`), so callers can
// resolve them the same way as a `#123`-style mention. Repeated refs to the
// same id are deduped.
export function extractAppResourceRefs(
  text: string,
  appDomain: string,
  resource: string,
): AppResourceRef[] {
  const refs = new Set<string>()
  for (const match of matchAppResourceUrls(text, appDomain, resource)) {
    refs.add(match.id)
  }
  return [...refs].map((ref) => ({ resource, ...classifyNumericOrId(ref) }))
}
