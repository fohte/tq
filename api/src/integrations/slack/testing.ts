import { vi } from 'vitest'

import { db } from '#db/connection'
import { oauthTokens } from '#db/schema'

export async function upsertSlackToken(
  accessToken: string,
  options?: { accountId?: string; accountLabel?: string | null },
) {
  const accountId = options?.accountId ?? 'T00000000'
  const accountLabel = options?.accountLabel ?? null
  await db
    .insert(oauthTokens)
    .values({ provider: 'slack', accountId, accountLabel, accessToken })
    .onConflictDoUpdate({
      target: [oauthTokens.provider, oauthTokens.accountId],
      set: { accountLabel, accessToken, updatedAt: new Date() },
    })
}

export function mockSlackApiResponse(body: unknown, init?: ResponseInit) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
    new Response(JSON.stringify(body), { status: 200, ...init }),
  )
}
