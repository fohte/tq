import { err, ok, okAsync, type Result, type ResultAsync } from 'neverthrow'
import { z } from 'zod'

import type {
  IntegrationConfigError,
  OAuthTokenMissingError,
  TokenRefreshError,
} from '#integrations/errors'
import { GithubApiError, githubProvider } from '#integrations/github/index'
import { getValidAccessToken } from '#integrations/oauth'
import { fetchJson, fetchJsonConditional } from '#lib/fetch-json'

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
    // GitHub owner/repo names are case-insensitive, but the DB's uniqueness
    // check on (owner, repo, number) is a plain case-sensitive comparison;
    // normalizing here keeps two differently-cased URLs for the same
    // issue/PR from slipping past that check as if they were distinct.
    owner: (groups['owner'] ?? '').toLowerCase(),
    repo: (groups['repo'] ?? '').toLowerCase(),
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

// Shared by fetchGithubIssue/fetchGithubIssueIfChanged once each has its own
// issues-API response in hand: resolves the pull_request vs. merged/closed
// distinction the issues API alone can't make (see the pulls-API fetch
// below), then shapes the result into GithubIssueData.
function resolveIssueState(
  ref: GithubResourceRef,
  issue: z.infer<typeof issueResponseSchema>,
  accessToken: string,
): ResultAsync<GithubIssueData, GithubApiError> {
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

  // The issues API reports a merged PR's state as merely "closed", so the
  // pulls API must be consulted to distinguish closed from merged.
  return fetchJson(
    `${GITHUB_API_BASE}/repos/${ref.owner}/${ref.repo}/pulls/${String(ref.number)}`,
    { headers: githubHeaders(accessToken) },
    pullResponseSchema,
    (message, cause, rejected) => new GithubApiError(message, cause, rejected),
  ).map((pull) => ({
    ...ref,
    kind: 'pull_request' as const,
    url: issue.html_url,
    title: issue.title,
    body: issue.body,
    state: pull.merged ? ('merged' as const) : issue.state,
  }))
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
    ).andThen((issue) => resolveIssueState(ref, issue, accessToken)),
  )
}

export type GithubIssueFetchResult =
  | { notModified: true }
  | { notModified: false; issue: GithubIssueData; etag: string | null }

const assignedIssueResponseSchema = z.object({
  number: z.number(),
  title: z.string(),
  body: z.string().nullable(),
  html_url: z.string(),
  pull_request: z.object({}).optional(),
  repository: z.object({
    name: z.string(),
    owner: z.object({ login: z.string() }),
  }),
})

// GitHub's `state` query param for this endpoint defaults to 'open', but is
// passed explicitly to document the intent: only open issues/PRs can be
// newly assigned in a way this sync cares about.
// `per_page=100` is GitHub's max; there is no pagination beyond that (a
// personal account is very unlikely to have more than 100 open assigned
// issues/PRs at once).
export function fetchAssignedIssues(): ResultAsync<
  GithubIssueData[],
  | GithubApiError
  | OAuthTokenMissingError
  | IntegrationConfigError
  | TokenRefreshError
> {
  return getValidAccessToken(githubProvider).andThen((accessToken) =>
    fetchJson(
      `${GITHUB_API_BASE}/issues?filter=assigned&state=open&per_page=100`,
      { headers: githubHeaders(accessToken) },
      z.array(assignedIssueResponseSchema),
      (message, cause, rejected) =>
        new GithubApiError(message, cause, rejected),
    ).map((issues) =>
      issues.map((issue): GithubIssueData => ({
        owner: issue.repository.owner.login.toLowerCase(),
        repo: issue.repository.name.toLowerCase(),
        number: issue.number,
        kind: issue.pull_request == null ? 'issue' : 'pull_request',
        url: issue.html_url,
        title: issue.title,
        body: issue.body,
        state: 'open',
      })),
    ),
  )
}

/**
 * Conditional variant of `fetchGithubIssue` for repeat syncs: pass the
 * `etag` recorded from a previous call to have GitHub answer with a bare 304
 * (no body) when nothing changed, which doesn't count against the primary
 * rate limit (see
 * https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api).
 * `etag` should be `null` for a resource never fetched before.
 */
export function fetchGithubIssueIfChanged(
  ref: GithubResourceRef,
  etag: string | null,
): ResultAsync<
  GithubIssueFetchResult,
  | GithubApiError
  | OAuthTokenMissingError
  | IntegrationConfigError
  | TokenRefreshError
> {
  return getValidAccessToken(githubProvider).andThen((accessToken) =>
    fetchJsonConditional(
      `${GITHUB_API_BASE}/repos/${ref.owner}/${ref.repo}/issues/${String(ref.number)}`,
      {
        headers: {
          ...githubHeaders(accessToken),
          ...(etag != null ? { 'If-None-Match': etag } : {}),
        },
      },
      issueResponseSchema,
      (message, cause, rejected) =>
        new GithubApiError(message, cause, rejected),
    ).andThen((result) => {
      if (result.notModified) {
        return okAsync<GithubIssueFetchResult, GithubApiError>({
          notModified: true,
        })
      }
      return resolveIssueState(ref, result.data, accessToken).map((issue) => ({
        notModified: false,
        issue,
        etag: result.etag,
      }))
    }),
  )
}
