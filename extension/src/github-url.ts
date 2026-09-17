// A trailing path segment (e.g. `/pull/12/files`) makes the lookup API
// 400; truncating it also collapses every page under one issue/PR to one URL.
const GITHUB_ISSUE_OR_PULL_URL_PATTERN =
  /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/(?:issues|pull)\/\d+/

export function githubLookupUrl(href: string): string | null {
  return GITHUB_ISSUE_OR_PULL_URL_PATTERN.exec(href)?.[0] ?? null
}
