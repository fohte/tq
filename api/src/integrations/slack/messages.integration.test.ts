import { afterEach, describe, expect, it, vi } from 'vitest'

import { SlackApiError } from '#integrations/slack/index'
import {
  resolveSlackPermalink,
  SlackChannelNotFoundError,
  SlackMessageNotFoundError,
  SlackNotConnectedError,
} from '#integrations/slack/messages'
import type { SlackPermalinkRef } from '#integrations/slack/permalink'
import {
  mockSlackApiResponse,
  upsertSlackToken,
} from '#integrations/slack/testing'
import { setupTestDb } from '#testing'

setupTestDb()

afterEach(() => {
  vi.restoreAllMocks()
})

function requestUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return input.url
}

interface AccountRoute {
  endpoint: string
  token: string
  body: unknown
}

// Routes each fetch call to the response for the account (`token`) whose
// request matches `endpoint`, so a test can assert that only the winning
// account's token is used for every call after conversations.info.
function mockAccountRoutedFetch(routes: AccountRoute[]) {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = requestUrl(input)
    const token = new Headers(init?.headers).get('Authorization')
    const route = routes.find(
      (r) => url.includes(r.endpoint) && token === `Bearer ${r.token}`,
    )
    if (route == null) {
      throw new Error(
        `unexpected fetch in test: url=${url} token=${String(token)}`,
      )
    }
    return Promise.resolve(
      new Response(JSON.stringify(route.body), { status: 200 }),
    )
  })
}

const ref: SlackPermalinkRef = {
  channelId: 'C0123456789',
  ts: '1753880000.123456',
  threadTs: null,
}

const threadRef: SlackPermalinkRef = {
  channelId: 'C0123456789',
  ts: '1753880000.123456',
  threadTs: '1753879999.000100',
}

describe('resolveSlackPermalink', () => {
  it('resolves a top-level message, stripping mrkdwn from the text', async () => {
    await upsertSlackToken('valid-token')
    mockSlackApiResponse({
      ok: true,
      channel: { id: 'C0123456789', name: 'general', is_private: false },
    })
    mockSlackApiResponse({
      ok: true,
      messages: [
        {
          ts: ref.ts,
          text: 'Hi <@U0123456> see <https://example.com|docs> or <https://example.com>',
          user: 'U0123456',
        },
      ],
    })
    mockSlackApiResponse({
      ok: true,
      user: {
        id: 'U0123456',
        name: 'alice',
        real_name: 'Alice Example',
        profile: {
          display_name: 'Alice',
          real_name: 'Alice Example',
          image_48: 'https://example.com/alice-48.png',
          image_72: 'https://example.com/alice-72.png',
        },
      },
    })

    const preview = (await resolveSlackPermalink(ref))._unsafeUnwrap()

    expect(preview).toEqual({
      channelId: 'C0123456789',
      channelName: 'general',
      isPrivate: false,
      authorName: 'Alice',
      authorAvatarUrl: 'https://example.com/alice-72.png',
      text: 'Hi @user see docs or https://example.com',
      ts: ref.ts,
      isThreadReply: false,
    })
  })

  it('resolves a thread reply', async () => {
    await upsertSlackToken('valid-token')
    mockSlackApiResponse({
      ok: true,
      channel: { id: 'C0123456789', name: 'general', is_private: false },
    })
    mockSlackApiResponse({
      ok: true,
      messages: [{ ts: threadRef.ts, text: 'Sounds good', user: 'U0123456' }],
    })
    mockSlackApiResponse({
      ok: true,
      user: {
        id: 'U0123456',
        name: 'alice',
        profile: { display_name: 'Alice' },
      },
    })

    const preview = (await resolveSlackPermalink(threadRef))._unsafeUnwrap()

    expect(preview).toEqual({
      channelId: 'C0123456789',
      channelName: 'general',
      isPrivate: false,
      authorName: 'Alice',
      authorAvatarUrl: null,
      text: 'Sounds good',
      ts: threadRef.ts,
      isThreadReply: true,
    })
  })

  it('pins conversations.replies to a single ts via the oldest param', async () => {
    await upsertSlackToken('valid-token')
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            channel: { id: 'C0123456789', name: 'general', is_private: false },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            messages: [
              { ts: threadRef.ts, text: 'Sounds good', user: 'U0123456' },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            user: {
              id: 'U0123456',
              name: 'alice',
              profile: { display_name: 'Alice' },
            },
          }),
          { status: 200 },
        ),
      )

    await resolveSlackPermalink(threadRef)

    const repliesCall = fetchSpy.mock.calls.find(([input]) =>
      requestUrl(input).includes('/conversations.replies'),
    )
    const repliesUrl = new URL(requestUrl(repliesCall?.[0] ?? ''))
    expect(Object.fromEntries(repliesUrl.searchParams)).toEqual({
      channel: threadRef.channelId,
      ts: threadRef.threadTs,
      oldest: threadRef.ts,
      latest: threadRef.ts,
      inclusive: 'true',
      limit: '1',
    })
  })

  it('resolves a bot message using bot_profile for the name and avatar', async () => {
    await upsertSlackToken('valid-token')
    mockSlackApiResponse({
      ok: true,
      channel: { id: 'C0123456789', name: 'general', is_private: true },
    })
    mockSlackApiResponse({
      ok: true,
      messages: [
        {
          ts: ref.ts,
          text: 'Deploy finished',
          username: 'Deploy Bot',
          bot_id: 'B0123456',
          bot_profile: {
            name: 'Deploy Bot',
            icons: {
              image_48: 'https://example.com/bot-48.png',
              image_72: 'https://example.com/bot-72.png',
            },
          },
        },
      ],
    })

    const preview = (await resolveSlackPermalink(ref))._unsafeUnwrap()

    expect(preview).toEqual({
      channelId: 'C0123456789',
      channelName: 'general',
      isPrivate: true,
      authorName: 'Deploy Bot',
      authorAvatarUrl: 'https://example.com/bot-72.png',
      text: 'Deploy finished',
      ts: ref.ts,
      isThreadReply: false,
    })
  })

  it('returns a SlackNotConnectedError when no Slack workspace is connected', async () => {
    const error = (await resolveSlackPermalink(ref))._unsafeUnwrapErr()

    expect(error).toEqual(new SlackNotConnectedError())
  })

  it('returns a SlackChannelNotFoundError when every connected account fails to access the channel', async () => {
    await upsertSlackToken('valid-token')
    mockSlackApiResponse({ ok: false, error: 'channel_not_found' })

    const error = (await resolveSlackPermalink(ref))._unsafeUnwrapErr()

    expect(error).toEqual(new SlackChannelNotFoundError(ref.channelId))
  })

  it('propagates a non-rejected SlackApiError from the last account instead of masking it as SlackChannelNotFoundError', async () => {
    await upsertSlackToken('valid-token')
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('boom', { status: 500 }),
    )

    const error = (await resolveSlackPermalink(ref))._unsafeUnwrapErr()

    expect(error).toEqual(new SlackApiError('boom', undefined, false))
  })

  it('returns a SlackMessageNotFoundError when Slack has no message at that ts', async () => {
    await upsertSlackToken('valid-token')
    mockSlackApiResponse({
      ok: true,
      channel: { id: 'C0123456789', name: 'general', is_private: false },
    })
    mockSlackApiResponse({ ok: true, messages: [] })

    const error = (await resolveSlackPermalink(ref))._unsafeUnwrapErr()

    expect(error).toEqual(new SlackMessageNotFoundError(ref.ts))
  })

  it('falls back to the next connected account until one can access the channel', async () => {
    await upsertSlackToken('token-1', { accountId: 'T1' })
    await upsertSlackToken('token-2', { accountId: 'T2' })

    mockAccountRoutedFetch([
      {
        endpoint: '/conversations.info',
        token: 'token-1',
        body: { ok: false, error: 'channel_not_found' },
      },
      {
        endpoint: '/conversations.info',
        token: 'token-2',
        body: {
          ok: true,
          channel: { id: ref.channelId, name: 'general', is_private: false },
        },
      },
      // Only token-2 (the account that resolved the channel) is expected to
      // be used for these two calls — a request made with token-1 would hit
      // no matching route and throw.
      {
        endpoint: '/conversations.history',
        token: 'token-2',
        body: {
          ok: true,
          messages: [{ ts: ref.ts, text: 'hello', user: 'U0123456' }],
        },
      },
      {
        endpoint: '/users.info',
        token: 'token-2',
        body: {
          ok: true,
          user: {
            id: 'U0123456',
            name: 'alice',
            profile: { display_name: 'Alice' },
          },
        },
      },
    ])

    const preview = (await resolveSlackPermalink(ref))._unsafeUnwrap()

    expect(preview).toEqual({
      channelId: ref.channelId,
      channelName: 'general',
      isPrivate: false,
      authorName: 'Alice',
      authorAvatarUrl: null,
      text: 'hello',
      ts: ref.ts,
      isThreadReply: false,
    })
  })
})
