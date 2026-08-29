import { errAsync, okAsync, ResultAsync } from 'neverthrow'
import { z } from 'zod'

import type {
  IntegrationConfigError,
  TokenRefreshError,
} from '#integrations/errors'
import { ensureValidAccessToken, listAccountTokens } from '#integrations/oauth'
import { SlackApiError, slackProvider } from '#integrations/slack/index'
import type { SlackPermalinkRef } from '#integrations/slack/permalink'
import type { OAuthTokenRow } from '#integrations/types'
import { fetchJson } from '#lib/fetch-json'

const SLACK_API_BASE = 'https://slack.com/api'

export class SlackNotConnectedError extends Error {
  constructor() {
    super('No Slack workspace connected. Please connect Slack first.')
    this.name = 'SlackNotConnectedError'
  }
}

export class SlackChannelNotFoundError extends Error {
  constructor(channelId: string) {
    super(`Slack channel not found or not accessible: ${channelId}`)
    this.name = 'SlackChannelNotFoundError'
  }
}

export class SlackMessageNotFoundError extends Error {
  constructor(ts: string) {
    super(`Slack message not found: ${ts}`)
    this.name = 'SlackMessageNotFoundError'
  }
}

const conversationsInfoResponseSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    channel: z.object({
      id: z.string(),
      name: z.string(),
      is_private: z.boolean().optional(),
    }),
  }),
  z.object({ ok: z.literal(false), error: z.string() }),
])

type SlackChannel = Extract<
  z.infer<typeof conversationsInfoResponseSchema>,
  { ok: true }
>['channel']

const slackMessageSchema = z.object({
  ts: z.string(),
  text: z.string().optional(),
  user: z.string().optional(),
  username: z.string().optional(),
  bot_id: z.string().optional(),
  bot_profile: z
    .object({
      name: z.string().optional(),
      icons: z
        .object({
          image_48: z.string().optional(),
          image_72: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
})

type SlackMessage = z.infer<typeof slackMessageSchema>

const conversationsMessagesResponseSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), messages: z.array(slackMessageSchema) }),
  z.object({ ok: z.literal(false), error: z.string() }),
])

const usersInfoResponseSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    user: z.object({
      id: z.string(),
      name: z.string(),
      real_name: z.string().optional(),
      profile: z.object({
        display_name: z.string().optional(),
        real_name: z.string().optional(),
        image_48: z.string().optional(),
        image_72: z.string().optional(),
      }),
    }),
  }),
  z.object({ ok: z.literal(false), error: z.string() }),
])

function slackHeaders(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` }
}

// Slack answers a rejected request with HTTP 200 and `ok: false` rather than
// a non-2xx status, so this can't be caught by fetchJson.
function unwrapOk<T, D extends { ok: true } | { ok: false; error: string }>(
  request: ResultAsync<D, SlackApiError>,
  select: (data: Extract<D, { ok: true }>) => T,
): ResultAsync<T, SlackApiError> {
  return request.andThen((data) =>
    data.ok
      ? // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- TS can't narrow a generic type parameter by its discriminant, even though `data.ok` was just checked above
        okAsync(select(data as Extract<D, { ok: true }>))
      : errAsync(new SlackApiError(data.error, undefined, true)),
  )
}

function fetchConversationsInfo(accessToken: string, channelId: string) {
  const params = new URLSearchParams({ channel: channelId })
  return unwrapOk(
    fetchJson(
      `${SLACK_API_BASE}/conversations.info?${params.toString()}`,
      { headers: slackHeaders(accessToken) },
      conversationsInfoResponseSchema,
      (message, cause, rejected) => new SlackApiError(message, cause, rejected),
    ),
    (data) => data.channel,
  )
}

function fetchConversationsHistory(
  accessToken: string,
  channelId: string,
  ts: string,
) {
  const params = new URLSearchParams({
    channel: channelId,
    latest: ts,
    inclusive: 'true',
    limit: '1',
  })
  return unwrapOk(
    fetchJson(
      `${SLACK_API_BASE}/conversations.history?${params.toString()}`,
      { headers: slackHeaders(accessToken) },
      conversationsMessagesResponseSchema,
      (message, cause, rejected) => new SlackApiError(message, cause, rejected),
    ),
    (data) => data.messages,
  )
}

// conversations.replies returns messages oldest-first (unlike
// conversations.history's newest-first), so `latest=ts&inclusive=true` alone
// would return the thread's oldest message in range, not the target one —
// `oldest` must be pinned to the same `ts` to narrow the range to one point.
function fetchConversationsReplies(
  accessToken: string,
  channelId: string,
  threadTs: string,
  ts: string,
) {
  const params = new URLSearchParams({
    channel: channelId,
    ts: threadTs,
    oldest: ts,
    latest: ts,
    inclusive: 'true',
    limit: '1',
  })
  return unwrapOk(
    fetchJson(
      `${SLACK_API_BASE}/conversations.replies?${params.toString()}`,
      { headers: slackHeaders(accessToken) },
      conversationsMessagesResponseSchema,
      (message, cause, rejected) => new SlackApiError(message, cause, rejected),
    ),
    (data) => data.messages,
  )
}

function fetchUserInfo(accessToken: string, userId: string) {
  const params = new URLSearchParams({ user: userId })
  return unwrapOk(
    fetchJson(
      `${SLACK_API_BASE}/users.info?${params.toString()}`,
      { headers: slackHeaders(accessToken) },
      usersInfoResponseSchema,
      (message, cause, rejected) => new SlackApiError(message, cause, rejected),
    ),
    (data) => data.user,
  )
}

// Channel IDs never collide across workspaces, so trying each connected
// account's token against conversations.info until one can see the channel
// uniquely identifies which workspace a permalink belongs to — there is no
// stored workspace subdomain to look it up by directly (see
// oauthTokens.accountId in db/schema.ts, keyed by team_id, not subdomain).
function findAccountForChannel(
  tokens: OAuthTokenRow[],
  channelId: string,
): ResultAsync<
  { accessToken: string; channel: SlackChannel },
  | SlackChannelNotFoundError
  | SlackApiError
  | IntegrationConfigError
  | TokenRefreshError
> {
  const [token, ...rest] = tokens
  if (token == null) {
    return errAsync(new SlackChannelNotFoundError(channelId))
  }

  return ensureValidAccessToken(slackProvider, token).andThen((accessToken) =>
    fetchConversationsInfo(accessToken, channelId)
      .map((channel) => ({ accessToken, channel }))
      .orElse((error) => {
        if (rest.length > 0) {
          return findAccountForChannel(rest, channelId)
        }
        // Only a Slack-rejected request (e.g. channel_not_found) means the
        // channel genuinely isn't accessible; a network/5xx/schema failure
        // must propagate as SlackApiError so it reaches the catch-all
        // 500+Sentry path instead of being misreported as "not found".
        return error instanceof SlackApiError && error.rejected
          ? errAsync(new SlackChannelNotFoundError(channelId))
          : errAsync(error)
      }),
  )
}

function fetchMessage(
  accessToken: string,
  ref: SlackPermalinkRef,
): ResultAsync<SlackMessage, SlackApiError | SlackMessageNotFoundError> {
  const request =
    ref.threadTs != null
      ? fetchConversationsReplies(
          accessToken,
          ref.channelId,
          ref.threadTs,
          ref.ts,
        )
      : fetchConversationsHistory(accessToken, ref.channelId, ref.ts)

  return request.andThen((messages) => {
    const message = messages[0]
    return message != null
      ? okAsync(message)
      : errAsync(new SlackMessageNotFoundError(ref.ts))
  })
}

interface ResolvedAuthor {
  name: string
  avatarUrl: string | null
}

// `||`-style "first non-empty" fallback on possibly-undefined strings, spelled
// out explicitly since @typescript-eslint/strict-boolean-expressions rejects
// a nullable string used directly as a boolean condition.
function firstNonEmpty(...values: (string | undefined)[]): string | undefined {
  return values.find((value) => value != null && value !== '')
}

function resolveAuthor(
  accessToken: string,
  message: SlackMessage,
): ResultAsync<ResolvedAuthor, SlackApiError> {
  if (message.user == null) {
    return okAsync({
      name: message.username ?? message.bot_profile?.name ?? 'Unknown',
      avatarUrl:
        message.bot_profile?.icons?.image_72 ??
        message.bot_profile?.icons?.image_48 ??
        null,
    })
  }

  return fetchUserInfo(accessToken, message.user).map((user) => ({
    name:
      firstNonEmpty(
        user.profile.display_name,
        user.profile.real_name,
        user.real_name,
      ) ?? user.name,
    avatarUrl: user.profile.image_72 ?? user.profile.image_48 ?? null,
  }))
}

/**
 * Best-effort mrkdwn -> plain text for a message preview. Not a full parser:
 * only unwraps the `<...>` link/mention/channel syntax that would otherwise
 * show up as raw markup in a preview.
 */
function stripSlackMrkdwn(text: string): string {
  return (
    text
      // <@U0123456> or <@U0123456|display> -> @user. Resolving the mentioned
      // user's real name would need an extra users.info call per mention,
      // which is out of scope for a lightweight preview.
      .replace(/<@[A-Z0-9]+(?:\|[^>]*)?>/g, '@user')
      // <#C0123456|channel-name> -> #channel-name. Must run before the
      // generic <url|label> replacement below, which would otherwise match
      // the same `<#id|name>` shape.
      .replace(/<#[A-Z0-9]+\|([^>]*)>/g, '#$1')
      .replace(/<([^|>]+)\|([^>]*)>/g, '$2')
      .replace(/<([^|>]+)>/g, '$1')
  )
}

export interface SlackPermalinkPreview {
  channelId: string
  channelName: string
  isPrivate: boolean
  authorName: string
  authorAvatarUrl: string | null
  text: string
  ts: string
  isThreadReply: boolean
}

export function resolveSlackPermalink(
  ref: SlackPermalinkRef,
): ResultAsync<
  SlackPermalinkPreview,
  | SlackNotConnectedError
  | SlackChannelNotFoundError
  | SlackMessageNotFoundError
  | SlackApiError
  | IntegrationConfigError
  | TokenRefreshError
> {
  return listAccountTokens(slackProvider).andThen((tokens) => {
    if (tokens.length === 0) {
      return errAsync(new SlackNotConnectedError())
    }

    return findAccountForChannel(tokens, ref.channelId).andThen(
      ({ accessToken, channel }) =>
        fetchMessage(accessToken, ref).andThen((message) =>
          resolveAuthor(accessToken, message).map((author) => ({
            channelId: channel.id,
            channelName: channel.name,
            isPrivate: channel.is_private ?? false,
            authorName: author.name,
            authorAvatarUrl: author.avatarUrl,
            text: stripSlackMrkdwn(message.text ?? ''),
            ts: message.ts,
            isThreadReply: ref.threadTs != null,
          })),
        ),
    )
  })
}
