import type { GithubLink, ResolveGithubUrlResult } from '#hooks/use-github-link'
import type { Task } from '#hooks/use-tasks'

export function makeGithubLink(
  overrides: Partial<GithubLink> = {},
): GithubLink {
  return {
    id: 'link-1',
    owner: 'fohte',
    repo: 'tq',
    number: 42,
    kind: 'issue',
    role: 'subject',
    notifyEvents: ['closed', 'reopened', 'comments', 'other'],
    url: 'https://github.com/fohte/tq/issues/42',
    state: 'open',
    title: 'Sample issue',
    lastSyncedAt: '2026-03-20T00:00:00.000Z',
    ...overrides,
  }
}

export function makeGithubBlocker(
  overrides: Partial<GithubLink> = {},
): GithubLink {
  const owner = overrides.owner ?? 'example-team'
  const repo = overrides.repo ?? 'sample-project'
  const number = overrides.number ?? 2048
  const kind = overrides.kind ?? 'pull_request'

  return makeGithubLink({
    ...overrides,
    id: overrides.id ?? 'github-blocker-1',
    owner,
    repo,
    number,
    kind,
    role: 'blocker',
    notifyEvents: overrides.notifyEvents ?? ['closed'],
    url:
      overrides.url ??
      `https://github.com/${owner}/${repo}/${kind === 'pull_request' ? 'pull' : 'issues'}/${String(number)}`,
  })
}

export type BlockedByGithubRef = Task['blockedByGithubRefs'][number]

export function makeBlockedByGithubRef(
  overrides: Partial<BlockedByGithubRef> = {},
): BlockedByGithubRef {
  const owner = overrides.owner ?? 'example-team'
  const repo = overrides.repo ?? 'sample-project'
  const number = overrides.number ?? 2048

  return {
    owner,
    repo,
    number,
    url:
      overrides.url ??
      `https://github.com/${owner}/${repo}/pull/${String(number)}`,
  }
}

export const issueLink = makeGithubLink({
  id: 'link-issue',
  number: 412,
  kind: 'issue',
  state: 'open',
  title: 'Support multiple GitHub links per task',
  url: 'https://github.com/fohte/tq/issues/412',
})

export const mergedPrLink = makeGithubLink({
  id: 'link-pr-436',
  number: 436,
  kind: 'pull_request',
  state: 'merged',
  title: 'api: allow associating multiple GitHub links with a task',
  url: 'https://github.com/fohte/tq/pull/436',
})

export const openPrLink = makeGithubLink({
  id: 'link-pr-441',
  number: 441,
  kind: 'pull_request',
  state: 'open',
  title: 'web: show representative chip with +N and hover popup',
  url: 'https://github.com/fohte/tq/pull/441',
})

export type GithubUrlPreview = Extract<
  ResolveGithubUrlResult,
  { linked: false }
>['preview']

function makeGithubUrlPreview(
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
): Extract<ResolveGithubUrlResult, { linked: false }> {
  return { linked: false, preview: makeGithubUrlPreview(overrides) }
}
