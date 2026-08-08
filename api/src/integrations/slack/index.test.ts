import { and, eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '#db/connection'
import { oauthTokens } from '#db/schema'
import {
  AccountIdentityError,
  IntegrationConfigError,
} from '#integrations/errors'
import {
  disconnectAccount,
  getAuthUrl,
  getIntegrationSummary,
  handleOAuthCallback,
  listConnectedAccounts,
} from '#integrations/oauth'
import { slackProvider } from '#integrations/slack/index'
import { TokenExchangeError } from '#lib/fetch-json'
import { assertDefined, setupTestDb } from '#testing'

setupTestDb()

const MOCK_ENV = {
  SLACK_CLIENT_ID: 'test-client-id',
  SLACK_CLIENT_SECRET: 'test-client-secret',
  SLACK_REDIRECT_URI: 'http://localhost:3001/api/slack/oauth-callback',
}

function setEnv() {
  for (const [key, value] of Object.entries(MOCK_ENV)) {
    process.env[key] = value
  }
}

function clearEnv() {
  for (const key of Object.keys(MOCK_ENV)) {
    Reflect.deleteProperty(process.env, key)
  }
}

async function upsertToken(accountId: string, accessToken: string) {
  const [token] = await db
    .insert(oauthTokens)
    .values({ provider: 'slack', accountId, accessToken })
    .onConflictDoUpdate({
      target: [oauthTokens.provider, oauthTokens.accountId],
      set: { accessToken, updatedAt: new Date() },
    })
    .returning()
  assertDefined(token)
  return token
}

async function selectTokenByAccountId(accountId: string) {
  const [token] = await db
    .select()
    .from(oauthTokens)
    .where(
      and(
        eq(oauthTokens.provider, 'slack'),
        eq(oauthTokens.accountId, accountId),
      ),
    )
    .limit(1)
  assertDefined(token)
  return token
}

beforeEach(() => {
  setEnv()
})

afterEach(() => {
  clearEnv()
  vi.restoreAllMocks()
})

function normalize(token: typeof oauthTokens.$inferSelect) {
  return {
    ...token,
    id: 'ID',
    createdAt: 'DATE',
    updatedAt: 'DATE',
  }
}

// Replaces the surrogate row id with a fixed placeholder, same idea as
// normalize() above, and sorts by label since listConnectedAccounts makes no
// promise about account order, so an IntegrationAccount[] can still be
// asserted with a single toEqual.
function normalizeAccounts(accounts: { id: string; label: string | null }[]) {
  return accounts
    .map((account) => ({ ...account, id: 'ID' }))
    .sort((a, b) => (a.label ?? '').localeCompare(b.label ?? ''))
}

function normalizeSummary(
  summary: Awaited<ReturnType<typeof getIntegrationSummary>>,
) {
  return { ...summary, accounts: normalizeAccounts(summary.accounts) }
}

describe('getAuthUrl', () => {
  it('returns a Slack OAuth authorization URL with correct parameters', () => {
    const url = getAuthUrl(slackProvider)._unsafeUnwrap()
    const parsed = new URL(url)

    expect(parsed.origin + parsed.pathname).toBe(
      'https://slack.com/oauth/v2_user/authorize',
    )
    expect(Object.fromEntries(parsed.searchParams)).toEqual({
      client_id: 'test-client-id',
      redirect_uri: 'http://localhost:3001/api/slack/oauth-callback',
      scope:
        'channels:history,groups:history,im:history,mpim:history,channels:read,groups:read,users:read',
    })
  })

  it('returns a config error when environment variables are missing', () => {
    clearEnv()

    const error = getAuthUrl(slackProvider)._unsafeUnwrapErr()

    expect(error).toEqual(
      new IntegrationConfigError(
        'invalid environment:\n' +
          '- missing required environment variable: SLACK_CLIENT_ID\n' +
          '- missing required environment variable: SLACK_CLIENT_SECRET\n' +
          '- missing required environment variable: SLACK_REDIRECT_URI',
      ),
    )
  })
})

describe('handleOAuthCallback', () => {
  it('exchanges code for a token and identifies the workspace, saving both to the database', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ ok: true, access_token: 'new-access-token' }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ ok: true, team: 'Acme', team_id: 'T12345' }),
          { status: 200 },
        ),
      )

    ;(await handleOAuthCallback(slackProvider, 'auth-code-123'))._unsafeUnwrap()

    const [savedToken] = await db
      .select()
      .from(oauthTokens)
      .where(eq(oauthTokens.provider, 'slack'))
      .limit(1)
    assertDefined(savedToken)

    expect(normalize(savedToken)).toEqual({
      id: 'ID',
      provider: 'slack',
      accountId: 'T12345',
      accountLabel: 'Acme',
      accessToken: 'new-access-token',
      refreshToken: null,
      expiresAt: null,
      createdAt: 'DATE',
      updatedAt: 'DATE',
    })
  })

  it('returns a token exchange error when the token endpoint returns a non-2xx response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('server error', { status: 500 }),
    )

    const error = (
      await handleOAuthCallback(slackProvider, 'bad-code')
    )._unsafeUnwrapErr()

    expect(error).toEqual(new TokenExchangeError('server error'))
  })

  it('returns a rejected token exchange error when Slack returns ok: false with a 200 status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: false, error: 'invalid_code' }), {
        status: 200,
      }),
    )

    const error = (
      await handleOAuthCallback(slackProvider, 'bad-code')
    )._unsafeUnwrapErr()

    expect(error).toEqual(
      new TokenExchangeError('invalid_code', undefined, true),
    )
  })

  it('discards the exchanged token when identifying the workspace fails', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ ok: true, access_token: 'new-access-token' }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response('server error', { status: 500 }))

    const error = (
      await handleOAuthCallback(slackProvider, 'auth-code-123')
    )._unsafeUnwrapErr()

    expect(error).toBeInstanceOf(AccountIdentityError)

    const savedTokens = await db
      .select()
      .from(oauthTokens)
      .where(eq(oauthTokens.provider, 'slack'))
    expect(savedTokens).toEqual([])
  })

  it('connecting a second workspace does not overwrite the first', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ ok: true, access_token: 'access-token-1' }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ ok: true, team: 'Acme', team_id: 'T1' }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ ok: true, access_token: 'access-token-2' }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ ok: true, team: 'Widgets Co', team_id: 'T2' }),
          { status: 200 },
        ),
      )

    ;(await handleOAuthCallback(slackProvider, 'auth-code-1'))._unsafeUnwrap()
    ;(await handleOAuthCallback(slackProvider, 'auth-code-2'))._unsafeUnwrap()

    const tokens = await db
      .select()
      .from(oauthTokens)
      .where(eq(oauthTokens.provider, 'slack'))

    expect(tokens.map((t) => t.accountId).sort()).toEqual(['T1', 'T2'])
  })
})

describe('listConnectedAccounts', () => {
  it('returns no accounts when no token exists', async () => {
    expect(
      (await listConnectedAccounts(slackProvider))._unsafeUnwrap(),
    ).toEqual([])
  })

  it('returns the account with its live-checked workspace name when a token exists', async () => {
    await upsertToken('T1', 'valid-token')

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, team: 'Acme', team_id: 'T1' }), {
        status: 200,
      }),
    )

    const accounts = (
      await listConnectedAccounts(slackProvider)
    )._unsafeUnwrap()

    expect(normalizeAccounts(accounts)).toEqual([{ id: 'ID', label: 'Acme' }])
  })

  it('excludes the account without deleting it when the connection check fails with a transient error', async () => {
    const token = await upsertToken('T1', 'some-token')

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: false, error: 'ratelimited' }), {
        status: 200,
      }),
    )

    expect(
      (await listConnectedAccounts(slackProvider))._unsafeUnwrap(),
    ).toEqual([])

    const remainingToken = await selectTokenByAccountId('T1')
    expect(remainingToken).toEqual(token)
  })

  it('drops the token and returns no accounts when it was revoked on Slack', async () => {
    await upsertToken('T1', 'revoked-token')

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: false, error: 'token_revoked' }), {
        status: 200,
      }),
    )

    expect(
      (await listConnectedAccounts(slackProvider))._unsafeUnwrap(),
    ).toEqual([])

    const [remainingToken] = await db
      .select()
      .from(oauthTokens)
      .where(eq(oauthTokens.provider, 'slack'))
      .limit(1)
    expect(remainingToken).toBeUndefined()
  })
})

describe('getIntegrationSummary', () => {
  it('reports configured true, multi-account support, and no accounts when no token exists', async () => {
    expect(await getIntegrationSummary(slackProvider)).toEqual({
      id: 'slack',
      displayName: 'Slack',
      configured: true,
      supportsMultipleAccounts: true,
      accounts: [],
    })
  })

  it('reports configured false when environment variables are missing', async () => {
    clearEnv()

    expect(await getIntegrationSummary(slackProvider)).toEqual({
      id: 'slack',
      displayName: 'Slack',
      configured: false,
      supportsMultipleAccounts: true,
      accounts: [],
    })
  })

  it('reports every connected workspace', async () => {
    await upsertToken('T1', 'access-token-1')
    await upsertToken('T2', 'access-token-2')

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ ok: true, team: 'Acme', team_id: 'T1' }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ ok: true, team: 'Widgets Co', team_id: 'T2' }),
          { status: 200 },
        ),
      )

    const summary = await getIntegrationSummary(slackProvider)

    expect(normalizeSummary(summary)).toEqual({
      id: 'slack',
      displayName: 'Slack',
      configured: true,
      supportsMultipleAccounts: true,
      accounts: [
        { id: 'ID', label: 'Acme' },
        { id: 'ID', label: 'Widgets Co' },
      ],
    })
  })
})

describe('disconnectAccount', () => {
  it('deletes the stored token', async () => {
    const token = await upsertToken('T1', 'valid-token')

    expect(
      (await disconnectAccount(slackProvider, token.id))._unsafeUnwrap(),
    ).toBe(true)

    const [remainingToken] = await db
      .select()
      .from(oauthTokens)
      .where(eq(oauthTokens.provider, 'slack'))
      .limit(1)
    expect(remainingToken).toBeUndefined()
  })
})
