// Mirrors api/src/integrations/github/issues.ts's GITHUB_ISSUE_URL_PATTERN,
// which is anchored at the end (`/?$`) — a URL with a trailing path segment
// (e.g. `/pull/12/files`) or query string doesn't match it and the API
// responds 400. Truncating to the issue/PR URL here (no `$` anchor, so the
// match simply stops at the last digit) keeps every page under one issue/PR
// resolving to the same lookup URL.
const GITHUB_ISSUE_OR_PULL_URL_PATTERN =
  /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/(?:issues|pull)\/\d+/

export function githubLookupUrl(href: string): string | null {
  return GITHUB_ISSUE_OR_PULL_URL_PATTERN.exec(href)?.[0] ?? null
}
