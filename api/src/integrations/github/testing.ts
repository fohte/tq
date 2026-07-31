import { vi } from 'vitest'

import { db } from '#db/connection'
import { oauthTokens } from '#db/schema'

export async function upsertGithubToken(accessToken: string) {
  await db
    .insert(oauthTokens)
    .values({ provider: 'github', accessToken })
    .onConflictDoUpdate({
      target: oauthTokens.provider,
      set: { accessToken, updatedAt: new Date() },
    })
}

export function mockGithubIssueResponse(
  overrides: Partial<Record<string, unknown>> = {},
  responseInit: ResponseInit = {},
) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        title: 'Bug: something broke',
        body: 'Steps to reproduce...',
        state: 'open',
        html_url: 'https://github.com/fohte/tq/issues/42',
        ...overrides,
      }),
      { status: 200, ...responseInit },
    ),
  )
}

export function mockGithubNotModifiedResponse() {
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
    new Response(null, { status: 304 }),
  )
}

export function mockAssignedIssuesResponse(
  issues: Array<{
    owner?: string
    repo?: string
    number?: number
    title?: string
    body?: string | null
    isPullRequest?: boolean
  }> = [],
) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
    new Response(
      JSON.stringify(
        issues.map((issue) => ({
          number: issue.number ?? 1,
          title: issue.title ?? 'Assigned issue',
          body: issue.body ?? null,
          html_url: `https://github.com/${issue.owner ?? 'fohte'}/${issue.repo ?? 'tq'}/issues/${String(issue.number ?? 1)}`,
          repository: {
            name: issue.repo ?? 'tq',
            owner: { login: issue.owner ?? 'fohte' },
          },
          ...(issue.isPullRequest === true ? { pull_request: {} } : {}),
        })),
      ),
      { status: 200 },
    ),
  )
}
