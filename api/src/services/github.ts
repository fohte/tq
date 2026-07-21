import { db } from '@api/db/connection'
import { oauthTokens } from '@api/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const GITHUB_AUTH_ENDPOINT = 'https://github.com/login/oauth/authorize'
const GITHUB_TOKEN_ENDPOINT = 'https://github.com/login/oauth/access_token'
const GITHUB_API_BASE = 'https://api.github.com'
// `repo` is the narrowest OAuth App scope covering private repo issues/PRs;
// GitHub has no read-only equivalent for private repos
// (see https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps).
const SCOPES = 'repo'
const PROVIDER = 'github'

const tokenResponseSchema = z.union([
  z.object({
    access_token: z.string(),
    token_type: z.string(),
    scope: z.string(),
  }),
  z.object({
    error: z.string(),
    error_description: z.string().optional(),
  }),
])

const githubUserSchema = z.object({
  login: z.string(),
})

function getConfig() {
  const clientId = process.env['GITHUB_CLIENT_ID']
  const clientSecret = process.env['GITHUB_CLIENT_SECRET']
  const redirectUri = process.env['GITHUB_REDIRECT_URI']

  if (
    clientId == null ||
    clientId === '' ||
    clientSecret == null ||
    clientSecret === '' ||
    redirectUri == null ||
    redirectUri === ''
  ) {
    throw new Error(
      'GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, and GITHUB_REDIRECT_URI environment variables are required',
    )
  }

  return { clientId, clientSecret, redirectUri }
}

export function getAuthUrl(): string {
  const { clientId, redirectUri } = getConfig()

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: SCOPES,
  })

  return `${GITHUB_AUTH_ENDPOINT}?${params.toString()}`
}

export async function handleOAuthCallback(code: string): Promise<void> {
  const { clientId, clientSecret, redirectUri } = getConfig()

  const response = await fetch(GITHUB_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token exchange failed: ${error}`)
  }

  const data = tokenResponseSchema.parse(await response.json())
  if ('error' in data) {
    throw new Error(
      `Token exchange failed: ${data.error_description ?? data.error}`,
    )
  }

  await db
    .insert(oauthTokens)
    .values({
      provider: PROVIDER,
      accessToken: data.access_token,
    })
    .onConflictDoUpdate({
      target: oauthTokens.provider,
      set: {
        accessToken: data.access_token,
        updatedAt: new Date(),
      },
    })
}

export type GithubConnectionStatus =
  { connected: false } | { connected: true; login: string }

export async function getConnectionStatus(): Promise<GithubConnectionStatus> {
  const [token] = await db
    .select()
    .from(oauthTokens)
    .where(eq(oauthTokens.provider, PROVIDER))
    .limit(1)

  if (!token) {
    return { connected: false }
  }

  const response = await fetch(`${GITHUB_API_BASE}/user`, {
    headers: {
      Authorization: `Bearer ${token.accessToken}`,
      Accept: 'application/vnd.github+json',
    },
  })

  if (response.status === 401) {
    // The token was revoked or expired on GitHub's side. Drop it so the
    // frontend can offer reconnecting instead of getting stuck on an
    // unrecoverable "connected" state.
    await disconnect()
    return { connected: false }
  }

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`GitHub API error: ${error}`)
  }

  const data = githubUserSchema.parse(await response.json())
  return { connected: true, login: data.login }
}

export async function disconnect(): Promise<void> {
  await db.delete(oauthTokens).where(eq(oauthTokens.provider, PROVIDER))
}
