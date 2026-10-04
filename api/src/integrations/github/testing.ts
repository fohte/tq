import { vi } from 'vitest'

import { db } from '#db/connection'
import { oauthTokens } from '#db/schema'

export async function upsertGithubToken(accessToken: string) {
  await db
    .insert(oauthTokens)
    .values({ provider: 'github', accountId: '', accessToken })
    .onConflictDoUpdate({
      target: [oauthTokens.provider, oauthTokens.accountId],
      set: { accessToken, updatedAt: new Date() },
    })
}

export function makeGithubTimelineEvent(
  event: string,
  login: string | null,
  createdAt = '2024-08-13T09:30:00Z',
) {
  return {
    event,
    ...(login === null ? {} : { actor: { login } }),
    created_at: createdAt,
  }
}

export function makeGithubIssueResponse(
  htmlUrl: string,
  overrides: Partial<Record<string, unknown>> = {},
  responseInit: ResponseInit = {},
) {
  return new Response(
    JSON.stringify({
      title: 'Bug: something broke',
      body: 'Steps to reproduce...',
      state: 'open',
      comments: 2,
      updated_at: '2024-08-12T09:30:00Z',
      state_reason: null,
      html_url: htmlUrl,
      ...overrides,
    }),
    { status: 200, ...responseInit },
  )
}

export function mockGithubIssueResponse(
  overrides: Partial<Record<string, unknown>> = {},
  responseInit: ResponseInit = {},
) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
    makeGithubIssueResponse(
      'https://github.com/fohte/tq/issues/42',
      overrides,
      responseInit,
    ),
  )
}

export function mockGithubActivityRoutes({
  login = 'authenticated-user',
  timelineEvents = [makeGithubTimelineEvent('closed', 'external-user')],
}: {
  login?: string
  timelineEvents?: Array<Record<string, unknown>>
} = {}) {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    if (url.pathname === '/user') {
      return Promise.resolve(
        new Response(JSON.stringify({ login }), { status: 200 }),
      )
    }
    if (/\/issues\/\d+\/timeline$/.test(url.pathname)) {
      return Promise.resolve(
        new Response(JSON.stringify(timelineEvents), { status: 200 }),
      )
    }
    return Promise.resolve(new Response('{}', { status: 404 }))
  })
}

export function mockGithubPullResponse(merged: boolean) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
    new Response(JSON.stringify({ merged }), { status: 200 }),
  )
}

export function mockAssignedIssuesResponse(
  issues: Array<{
    owner?: string
    repo?: string
    number?: number
    title?: string
    body?: string | null
    comments?: number
    updatedAt?: string
    stateReason?: string | null
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
          comments: issue.comments ?? 1,
          updated_at: issue.updatedAt ?? '2024-08-12T09:30:00Z',
          state_reason: issue.stateReason ?? null,
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
