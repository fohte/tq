import { err, ok, okAsync, type Result, ResultAsync } from 'neverthrow'
import { z } from 'zod'

import type {
  IntegrationConfigError,
  OAuthTokenMissingError,
  TokenRefreshError,
} from '#integrations/errors'
import { GithubApiError, githubProvider } from '#integrations/github/index'
import {
  githubHeaders,
  type GithubResourceRef,
} from '#integrations/github/issues'
import { getValidAccessToken } from '#integrations/oauth'
import { fetchJson, fetchJsonWithHeaders } from '#lib/fetch-json'

const GITHUB_API_BASE = 'https://api.github.com'

const githubUserSchema = z.object({ login: z.string() })
const githubTimelineActorSchema = z
  .object({ login: z.string(), type: z.string().optional() })
  .nullable()
  .optional()

const githubTimelineEventSchema = z
  .object({
    event: z.string(),
    actor: githubTimelineActorSchema,
    user: githubTimelineActorSchema,
    created_at: z.string().optional(),
    submitted_at: z.string().optional(),
    updated_at: z.string().optional(),
    committed_at: z.string().optional(),
  })
  .loose()

const githubTimelineSchema = z.array(githubTimelineEventSchema)

export interface GithubIssueActivityEvent {
  event: string
  login: string | null
  actorType: string | null
  occurredAt: Date | null
}

export interface GithubIssueActivity {
  authenticatedUserLogin: string
  events: GithubIssueActivityEvent[]
}

type GithubActivityError =
  | GithubApiError
  | OAuthTokenMissingError
  | IntegrationConfigError
  | TokenRefreshError

let cachedGithubLogin:
  | {
      accessToken: string
      result: ResultAsync<string, GithubApiError>
    }
  | undefined

function getGithubLogin(
  accessToken: string,
): ResultAsync<string, GithubApiError> {
  if (cachedGithubLogin?.accessToken === accessToken) {
    return cachedGithubLogin.result
  }

  const result = fetchJson(
    `${GITHUB_API_BASE}/user`,
    { headers: githubHeaders(accessToken) },
    githubUserSchema,
    (message, cause, rejected) => new GithubApiError(message, cause, rejected),
  )
    .map((user) => user.login)
    .mapErr((error) => {
      if (cachedGithubLogin?.accessToken === accessToken) {
        cachedGithubLogin = undefined
      }
      return error
    })

  cachedGithubLogin = { accessToken, result }
  return result
}

function nextPageUrl(
  linkHeader: string | null,
): Result<string | null, GithubApiError> {
  const nextLink = linkHeader
    ?.split(',')
    .find((link) => /;\s*rel="?next"?/.test(link))
  const url = nextLink?.match(/<([^>]+)>/)?.[1]
  if (url == null) {
    return ok(null)
  }

  if (!url.startsWith(`${GITHUB_API_BASE}/`)) {
    return err(
      new GithubApiError('GitHub returned an invalid timeline page URL'),
    )
  }

  return ok(url)
}

function fetchTimelinePage(
  url: string,
  accessToken: string,
): ResultAsync<
  { events: z.infer<typeof githubTimelineSchema>; nextPage: string | null },
  GithubApiError
> {
  return fetchJsonWithHeaders(
    url,
    { headers: githubHeaders(accessToken) },
    githubTimelineSchema,
    (message, cause, rejected) => new GithubApiError(message, cause, rejected),
  ).andThen(({ data: events, headers }) =>
    nextPageUrl(headers.get('link')).map((nextPage) => ({ events, nextPage })),
  )
}

function fetchAllTimelineEvents(
  url: string,
  accessToken: string,
  collected: z.infer<typeof githubTimelineSchema> = [],
): ResultAsync<z.infer<typeof githubTimelineSchema>, GithubApiError> {
  return fetchTimelinePage(url, accessToken).andThen((page) => {
    const events = [...collected, ...page.events]
    return page.nextPage == null
      ? okAsync(events)
      : fetchAllTimelineEvents(page.nextPage, accessToken, events)
  })
}

function toActivityEvent(
  event: z.infer<typeof githubTimelineEventSchema>,
): GithubIssueActivityEvent {
  const actor = event.actor ?? event.user
  const timestamp =
    event.created_at ??
    event.submitted_at ??
    event.updated_at ??
    event.committed_at
  const occurredAt = timestamp == null ? null : new Date(timestamp)

  return {
    event: event.event,
    login: actor?.login ?? null,
    actorType: actor?.type ?? null,
    occurredAt:
      occurredAt != null && !Number.isNaN(occurredAt.getTime())
        ? occurredAt
        : null,
  }
}

export function fetchGithubIssueActivity(
  ref: GithubResourceRef,
): ResultAsync<GithubIssueActivity, GithubActivityError> {
  return getValidAccessToken(githubProvider).andThen((accessToken) =>
    getGithubLogin(accessToken).andThen((authenticatedUserLogin) =>
      fetchAllTimelineEvents(
        `${GITHUB_API_BASE}/repos/${ref.owner}/${ref.repo}/issues/${String(ref.number)}/timeline?per_page=100`,
        accessToken,
      ).map((events) => ({
        authenticatedUserLogin,
        events: events.map(toActivityEvent),
      })),
    ),
  )
}
