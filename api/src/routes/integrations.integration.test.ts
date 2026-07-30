import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { app } from '#app'
import { db } from '#db/connection'
import { oauthTokens } from '#db/schema'
import { jsonBody, setupTestDb } from '#testing'

setupTestDb()

const GITHUB_ENV = {
  GITHUB_CLIENT_ID: 'test-client-id',
  GITHUB_CLIENT_SECRET: 'test-client-secret',
  GITHUB_REDIRECT_URI: 'http://localhost:3001/api/github/oauth-callback',
}

function setGithubEnv() {
  for (const [key, value] of Object.entries(GITHUB_ENV)) {
    process.env[key] = value
  }
}

function clearGithubEnv() {
  for (const key of Object.keys(GITHUB_ENV)) {
    Reflect.deleteProperty(process.env, key)
  }
}

async function upsertToken(provider: string, accessToken: string) {
  await db
    .insert(oauthTokens)
    .values({ provider, accessToken })
    .onConflictDoUpdate({
      target: oauthTokens.provider,
      set: { accessToken, updatedAt: new Date() },
    })
}

afterEach(() => {
  clearGithubEnv()
  vi.restoreAllMocks()
})

describe('GET /api/integrations', () => {
  it('lists every registered provider with its connection and config state', async () => {
    setGithubEnv()
    await upsertToken('github', 'valid-token')
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ login: 'fohte' }), { status: 200 }),
    )

    const res = await app.request('/api/integrations')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([
      {
        id: 'github',
        displayName: 'GitHub',
        connected: true,
        login: 'fohte',
        configured: true,
      },
      {
        id: 'google_calendar',
        displayName: 'Google Calendar',
        connected: false,
        configured: false,
      },
    ])
  })
})

describe('GET /api/integrations/:id/auth-url', () => {
  it('returns the authorization URL for a configured provider', async () => {
    setGithubEnv()

    const res = await app.request('/api/integrations/github/auth-url')

    expect(res.status).toBe(200)
    const { url } = await jsonBody<{ url: string }>(res)
    const parsed = new URL(url)
    expect(parsed.origin + parsed.pathname).toBe(
      'https://github.com/login/oauth/authorize',
    )
  })

  it('returns 404 for an unregistered provider id', async () => {
    const res = await app.request('/api/integrations/unknown/auth-url')

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Not found' })
  })
})

describe('DELETE /api/integrations/:id', () => {
  it('disconnects a connected provider', async () => {
    await upsertToken('github', 'valid-token')

    const res = await app.request('/api/integrations/github', {
      method: 'DELETE',
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ message: 'Disconnected' })

    const [remaining] = await db
      .select()
      .from(oauthTokens)
      .where(eq(oauthTokens.provider, 'github'))
      .limit(1)
    expect(remaining).toBeUndefined()
  })

  it('returns 404 for an unregistered provider id', async () => {
    const res = await app.request('/api/integrations/unknown', {
      method: 'DELETE',
    })

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Not found' })
  })
})
