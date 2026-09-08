import type { GithubLink, ResolveGithubUrlResult } from '#hooks/use-github-link'

export function makeGithubLink(
  overrides: Partial<GithubLink> = {},
): GithubLink {
  return {
    id: 'link-1',
    owner: 'fohte',
    repo: 'tq',
    number: 42,
    kind: 'issue',
    url: 'https://github.com/fohte/tq/issues/42',
    state: 'open',
    title: 'Sample issue',
    lastSyncedAt: '2026-03-20T00:00:00.000Z',
    ...overrides,
  }
}

export type GithubUrlPreview = Extract<
  ResolveGithubUrlResult,
  { linked: false }
>['preview']

export function makeGithubUrlPreview(
  overrides: Partial<GithubUrlPreview> = {},
): GithubUrlPreview {
  return {
    owner: 'fohte',
    repo: 'tq',
    number: 123,
    kind: 'issue',
    url: 'https://github.com/fohte/tq/issues/123',
    title: 'Sample issue',
    body: null,
    state: 'open',
    ...overrides,
  }
}

export function makeResolveGithubUrlResult(
  overrides: Partial<GithubUrlPreview> = {},
): ResolveGithubUrlResult {
  return { linked: false, preview: makeGithubUrlPreview(overrides) }
}
