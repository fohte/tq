import { err, ok, okAsync, type Result, type ResultAsync } from 'neverthrow'
import { z } from 'zod'

import type {
  IntegrationConfigError,
  OAuthTokenMissingError,
  TokenRefreshError,
} from '#integrations/errors'
import { GithubApiError, githubProvider } from '#integrations/github/index'
import { getValidAccessToken } from '#integrations/oauth'
import { fetchJson } from '#lib/fetch-json'

const GITHUB_API_BASE = 'https://api.github.com'

// The issues API also serves pull requests (a PR is an issue under the
// hood), so both /issues/ and /pull/ URLs resolve through the same
// endpoint; the URL's path segment is only used to validate the link, not
// to determine the resource kind (see fetchGithubIssue).
const GITHUB_ISSUE_URL_PATTERN =
  /^https:\/\/github\.com\/(?<owner>[^/\s]+)\/(?<repo>[^/\s]+)\/(?:issues|pull)\/(?<number>\d+)\/?$/

export interface GithubResourceRef {
  owner: string
  repo: string
  number: number
}

export class InvalidGithubUrlError extends Error {
  constructor(url: string) {
    super(`Not a GitHub issue or pull request URL: ${url}`)
    this.name = 'InvalidGithubUrlError'
  }
}

export function parseGithubIssueUrl(
  url: string,
): Result<GithubResourceRef, InvalidGithubUrlError> {
  const match = GITHUB_ISSUE_URL_PATTERN.exec(url.trim().split(/[?#]/)[0] ?? '')
  const groups = match?.groups
  if (!groups) {
    return err(new InvalidGithubUrlError(url))
  }

  return ok({
    owner: groups['owner'] ?? '',
    repo: groups['repo'] ?? '',
    number: Number(groups['number']),
  })
}

export interface GithubIssueData extends GithubResourceRef {
  kind: 'issue' | 'pull_request'
  url: string
  title: string
  body: string | null
  state: 'open' | 'closed' | 'merged'
}

const issueResponseSchema = z.object({
  title: z.string(),
  body: z.string().nullable(),
  state: z.enum(['open', 'closed']),
  html_url: z.string(),
  // Present only when the issue number actually refers to a pull request.
  pull_request: z.object({}).optional(),
})

const pullResponseSchema = z.object({
  merged: z.boolean(),
})

function githubHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/vnd.github+json',
  }
}

export function fetchGithubIssue(
  ref: GithubResourceRef,
): ResultAsync<
  GithubIssueData,
  | GithubApiError
  | OAuthTokenMissingError
  | IntegrationConfigError
  | TokenRefreshError
> {
  return getValidAccessToken(githubProvider).andThen((accessToken) =>
    fetchJson(
      `${GITHUB_API_BASE}/repos/${ref.owner}/${ref.repo}/issues/${String(ref.number)}`,
      { headers: githubHeaders(accessToken) },
      issueResponseSchema,
      (message, cause, rejected) =>
        new GithubApiError(message, cause, rejected),
    ).andThen((issue) => {
      // A PR can only be merged once closed, and the issues API's "closed"
      // already disambiguates from "open" — the pulls API is only needed to
      // tell closed-and-merged from closed-and-not-merged.
      if (issue.pull_request == null || issue.state !== 'closed') {
        return okAsync<GithubIssueData, GithubApiError>({
          ...ref,
          kind: issue.pull_request == null ? 'issue' : 'pull_request',
          url: issue.html_url,
          title: issue.title,
          body: issue.body,
          state: issue.state,
        })
      }

      // The issues API reports a merged PR's state as merely "closed", so
      // the pulls API must be consulted to distinguish closed from merged.
      return fetchJson(
        `${GITHUB_API_BASE}/repos/${ref.owner}/${ref.repo}/pulls/${String(ref.number)}`,
        { headers: githubHeaders(accessToken) },
        pullResponseSchema,
        (message, cause, rejected) =>
          new GithubApiError(message, cause, rejected),
      ).map((pull) => ({
        ...ref,
        kind: 'pull_request' as const,
        url: issue.html_url,
        title: issue.title,
        body: issue.body,
        state: pull.merged ? ('merged' as const) : issue.state,
      }))
    }),
  )
}
