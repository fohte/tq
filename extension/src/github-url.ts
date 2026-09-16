// api's GITHUB_ISSUE_URL_PATTERN (api/src/integrations/github/issues.ts) is
// anchored at the end, so a trailing path segment (e.g. `/pull/12/files`)
// fails to match and 400s; truncating it off here also collapses every page
// under one issue/PR to the same lookup URL.
const GITHUB_ISSUE_OR_PULL_URL_PATTERN =
  /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/(?:issues|pull)\/\d+/

export function githubLookupUrl(href: string): string | null {
  return GITHUB_ISSUE_OR_PULL_URL_PATTERN.exec(href)?.[0] ?? null
}
