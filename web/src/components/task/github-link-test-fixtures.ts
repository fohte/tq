import type { GithubLink } from '#hooks/use-github-link'

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
