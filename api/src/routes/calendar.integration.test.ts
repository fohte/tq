import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { app } from '#app'
import { upsertGoogleCalendarToken } from '#integrations/google-calendar/testing'
import type { ExternalEvent } from '#integrations/types'
import { jsonBody, setupTestDb } from '#testing'

setupTestDb()

const GOOGLE_ENV = {
  GOOGLE_CLIENT_ID: 'test-client-id',
  GOOGLE_CLIENT_SECRET: 'test-client-secret',
  GOOGLE_REDIRECT_URI: 'http://localhost:3001/api/calendar/oauth-callback',
}

function setGoogleEnv() {
  for (const [key, value] of Object.entries(GOOGLE_ENV)) {
    process.env[key] = value
  }
}

function clearGoogleEnv() {
  for (const key of Object.keys(GOOGLE_ENV)) {
    Reflect.deleteProperty(process.env, key)
  }
}

function requestEvents() {
  return app.request(
    '/api/calendar/events?timeMin=2026-03-22T00:00:00.000Z&timeMax=2026-03-23T00:00:00.000Z',
  )
}

// fetch's first parameter can be a Request, which has no meaningful
// `toString()`, so this narrows to the cases fetchJson actually calls fetch
// with (a plain URL string) or could (a URL/Request instance) instead of
// stringifying `input` directly.
function requestUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return input.url
}

const invalidGrantResponse = () =>
  new Response(
    JSON.stringify({
      error: 'invalid_grant',
      error_description: 'Token has been expired or revoked.',
    }),
    { status: 400 },
  )

beforeEach(() => {
  setGoogleEnv()
})

afterEach(() => {
  clearGoogleEnv()
  vi.restoreAllMocks()
})

describe('GET /api/calendar/events', () => {
  it('returns 401 when no Google account is connected', async () => {
    const res = await requestEvents()

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({
      error: 'No OAuth token found. Please authenticate first.',
    })
  })

  it('merges events from every connected account', async () => {
    await upsertGoogleCalendarToken({
      accountId: 'google-sub-1',
      accountLabel: 'user1@example.com',
      accessToken: 'valid-token-1',
      refreshToken: 'refresh-token-1',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })
    await upsertGoogleCalendarToken({
      accountId: 'google-sub-2',
      accountLabel: 'user2@example.com',
      accessToken: 'valid-token-2',
      refreshToken: 'refresh-token-2',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })

    // Keyed by the request's Authorization header rather than call order,
    // since accounts are fanned out over with no promise about which
    // account's request goes out first.
    vi.spyOn(globalThis, 'fetch').mockImplementation((_input, init) => {
      const authorization = new Headers(init?.headers).get('Authorization')
      if (authorization === 'Bearer valid-token-1') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              items: [
                {
                  id: 'event-1',
                  summary: 'Standup',
                  start: { dateTime: '2026-03-22T09:00:00Z' },
                  end: { dateTime: '2026-03-22T09:30:00Z' },
                },
              ],
            }),
            { status: 200 },
          ),
        )
      }
      if (authorization === 'Bearer valid-token-2') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              items: [
                {
                  id: 'event-2',
                  summary: 'Review',
                  start: { dateTime: '2026-03-22T14:00:00Z' },
                  end: { dateTime: '2026-03-22T14:30:00Z' },
                },
              ],
            }),
            { status: 200 },
          ),
        )
      }
      throw new Error(
        `unexpected fetch in test: Authorization=${String(authorization)}`,
      )
    })

    const res = await requestEvents()

    expect(res.status).toBe(200)
    const body = await jsonBody<ExternalEvent[]>(res)
    expect([...body].sort((a, b) => a.id.localeCompare(b.id))).toEqual([
      {
        id: 'event-1',
        summary: 'Standup',
        startTime: '2026-03-22T09:00:00Z',
        endTime: '2026-03-22T09:30:00Z',
        isAllDay: false,
        source: 'google_calendar',
        accountId: 'google-sub-1',
        accountLabel: 'user1@example.com',
      },
      {
        id: 'event-2',
        summary: 'Review',
        startTime: '2026-03-22T14:00:00Z',
        endTime: '2026-03-22T14:30:00Z',
        isAllDay: false,
        source: 'google_calendar',
        accountId: 'google-sub-2',
        accountLabel: 'user2@example.com',
      },
    ])
  })

  it('returns only the live account events when a different connected account has a revoked refresh token', async () => {
    await upsertGoogleCalendarToken({
      accountId: 'google-sub-1',
      accountLabel: 'user1@example.com',
      accessToken: 'valid-token-1',
      refreshToken: 'refresh-token-1',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })
    // expiresAt in the past forces ensureValidAccessToken to actually
    // attempt a refresh, which is what surfaces a revoked refresh token.
    await upsertGoogleCalendarToken({
      accountId: 'google-sub-2',
      accountLabel: 'user2@example.com',
      accessToken: 'stale-access-token-2',
      refreshToken: 'revoked-refresh-token-2',
      expiresAt: new Date(Date.now() - 1000),
    })

    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = requestUrl(input)
      const authorization = new Headers(init?.headers).get('Authorization')

      if (url.includes('oauth2.googleapis.com/token')) {
        return Promise.resolve(invalidGrantResponse())
      }
      if (authorization === 'Bearer valid-token-1') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              items: [
                {
                  id: 'event-1',
                  summary: 'Standup',
                  start: { dateTime: '2026-03-22T09:00:00Z' },
                  end: { dateTime: '2026-03-22T09:30:00Z' },
                },
              ],
            }),
            { status: 200 },
          ),
        )
      }
      throw new Error(
        `unexpected fetch in test: url=${url} Authorization=${String(authorization)}`,
      )
    })

    const res = await requestEvents()

    expect(res.status).toBe(200)
    expect(await jsonBody<ExternalEvent[]>(res)).toEqual([
      {
        id: 'event-1',
        summary: 'Standup',
        startTime: '2026-03-22T09:00:00Z',
        endTime: '2026-03-22T09:30:00Z',
        isAllDay: false,
        source: 'google_calendar',
        accountId: 'google-sub-1',
        accountLabel: 'user1@example.com',
      },
    ])
  })

  it('returns 401 when every connected account has a revoked refresh token', async () => {
    await upsertGoogleCalendarToken({
      accountId: 'google-sub-1',
      accountLabel: 'user1@example.com',
      accessToken: 'stale-access-token-1',
      refreshToken: 'revoked-refresh-token-1',
      expiresAt: new Date(Date.now() - 1000),
    })
    await upsertGoogleCalendarToken({
      accountId: 'google-sub-2',
      accountLabel: 'user2@example.com',
      accessToken: 'stale-access-token-2',
      refreshToken: 'revoked-refresh-token-2',
      expiresAt: new Date(Date.now() - 1000),
    })

    // A fresh Response per call: a Response body can only be read once, and
    // both accounts' refresh attempts read theirs (via res.text()).
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(invalidGrantResponse()),
    )

    const res = await requestEvents()

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({
      error: 'Google Calendar authentication is required',
    })
  })
})
