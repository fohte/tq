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
