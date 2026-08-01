import { afterEach, describe, expect, it, vi } from 'vitest'

import { app } from '#app'
import {
  mockSlackApiResponse,
  upsertSlackToken,
} from '#integrations/slack/testing'
import { setupTestDb } from '#testing'

setupTestDb()

afterEach(() => {
  vi.restoreAllMocks()
})

async function resolve(url: string) {
  return app.request('/api/slack/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
}

describe('POST /api/slack/resolve', () => {
  it('returns a preview for a resolvable permalink', async () => {
    await upsertSlackToken('valid-token')
    mockSlackApiResponse({
      ok: true,
      channel: { id: 'C0123456789', name: 'general', is_private: false },
    })
    mockSlackApiResponse({
      ok: true,
      messages: [
        { ts: '1753880000.123456', text: 'Hello team', user: 'U0123456' },
      ],
    })
    mockSlackApiResponse({
      ok: true,
      user: {
        id: 'U0123456',
        name: 'alice',
        profile: { display_name: 'Alice' },
      },
    })

    const res = await resolve(
      'https://acme.slack.com/archives/C0123456789/p1753880000123456',
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      preview: {
        channelId: 'C0123456789',
        channelName: 'general',
        isPrivate: false,
        authorName: 'Alice',
        authorAvatarUrl: null,
        text: 'Hello team',
        ts: '1753880000.123456',
        isThreadReply: false,
      },
    })
  })

  it('returns 400 for a non-Slack-permalink URL', async () => {
    const res = await resolve('https://example.com/not-slack')

    expect(res.status).toBe(400)
  })

  it('returns 400 when Slack is not connected', async () => {
    const res = await resolve(
      'https://acme.slack.com/archives/C0123456789/p1753880000123456',
    )

    expect(res.status).toBe(400)
  })

  it('returns 404 when the channel is not accessible with any connected account', async () => {
    await upsertSlackToken('valid-token')
    mockSlackApiResponse({ ok: false, error: 'channel_not_found' })

    const res = await resolve(
      'https://acme.slack.com/archives/C0123456789/p1753880000123456',
    )

    expect(res.status).toBe(404)
  })

  it('returns 500 when Slack itself fails with a non-rejected error', async () => {
    await upsertSlackToken('valid-token')
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('boom', { status: 500 }),
    )

    const res = await resolve(
      'https://acme.slack.com/archives/C0123456789/p1753880000123456',
    )

    expect(res.status).toBe(500)
  })
})
