import { afterEach, describe, expect, it, vi } from 'vitest'

import { OAuthTokenMissingError } from '#integrations/errors'
import { GithubApiError } from '#integrations/github/index'
import {
  fetchGithubIssue,
  fetchGithubIssueIfChanged,
} from '#integrations/github/issues'
import { upsertGithubToken } from '#integrations/github/testing'
import { setupTestDb } from '#testing'

setupTestDb()

afterEach(() => {
  vi.restoreAllMocks()
})

const ref = { owner: 'fohte', repo: 'tq', number: 42 }

describe('fetchGithubIssue', () => {
  it('returns an OAuthTokenMissingError when GitHub is not connected', async () => {
    const error = (await fetchGithubIssue(ref))._unsafeUnwrapErr()

    expect(error).toEqual(new OAuthTokenMissingError())
  })

  it('fetches an issue', async () => {
    await upsertGithubToken('valid-token')
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          title: 'Bug: something broke',
          body: 'Steps to reproduce...',
          state: 'open',
          comments: 2,
          updated_at: '2024-08-12T09:30:00Z',
          state_reason: null,
          html_url: 'https://github.com/fohte/tq/issues/42',
        }),
        { status: 200 },
      ),
    )

    const issue = (await fetchGithubIssue(ref))._unsafeUnwrap()

    expect(issue).toEqual({
      owner: 'fohte',
      repo: 'tq',
      number: 42,
      kind: 'issue',
      url: 'https://github.com/fohte/tq/issues/42',
      title: 'Bug: something broke',
      body: 'Steps to reproduce...',
      state: 'open',
      commentsCount: 2,
      githubUpdatedAt: '2024-08-12T09:30:00Z',
      stateReason: null,
    })
  })

  it('fetches an open pull request', async () => {
    await upsertGithubToken('valid-token')
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          title: 'Add feature',
          body: null,
          state: 'open',
          comments: 3,
          updated_at: '2024-08-13T10:20:00Z',
          state_reason: null,
          html_url: 'https://github.com/fohte/tq/pull/42',
          pull_request: {},
        }),
        { status: 200 },
      ),
    )

    const issue = (await fetchGithubIssue(ref))._unsafeUnwrap()

    expect(issue).toEqual({
      owner: 'fohte',
      repo: 'tq',
      number: 42,
      kind: 'pull_request',
      url: 'https://github.com/fohte/tq/pull/42',
      title: 'Add feature',
      body: null,
      state: 'open',
      commentsCount: 3,
      githubUpdatedAt: '2024-08-13T10:20:00Z',
      stateReason: null,
    })
  })

  it('reports a merged pull request as state "merged" via the pulls API', async () => {
    await upsertGithubToken('valid-token')
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            title: 'Add feature',
            body: null,
            state: 'closed',
            comments: 4,
            updated_at: '2024-08-14T08:00:00Z',
            state_reason: 'completed',
            html_url: 'https://github.com/fohte/tq/pull/42',
            pull_request: {},
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ merged: true }), { status: 200 }),
      )

    const issue = (await fetchGithubIssue(ref))._unsafeUnwrap()

    expect(issue.state).toBe('merged')
  })

  it('reports a closed-but-not-merged pull request as state "closed"', async () => {
    await upsertGithubToken('valid-token')
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            title: 'Add feature',
            body: null,
            state: 'closed',
            comments: 4,
            updated_at: '2024-08-14T08:00:00Z',
            state_reason: 'not_planned',
            html_url: 'https://github.com/fohte/tq/pull/42',
            pull_request: {},
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ merged: false }), { status: 200 }),
      )

    const issue = (await fetchGithubIssue(ref))._unsafeUnwrap()

    expect(issue.state).toBe('closed')
  })

  it('returns a rejected GithubApiError when the issue is not found', async () => {
    await upsertGithubToken('valid-token')
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Not Found', { status: 404 }),
    )

    const error = (await fetchGithubIssue(ref))._unsafeUnwrapErr()

    expect(error).toEqual(new GithubApiError('Not Found', undefined, true))
  })
})

describe('fetchGithubIssueIfChanged', () => {
  it('sends the etag as If-None-Match', async () => {
    await upsertGithubToken('valid-token')
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 304 }))

    await fetchGithubIssueIfChanged(ref, '"abc123"')

    const [, init] = fetchSpy.mock.calls[0] ?? []
    expect(new Headers(init?.headers).get('If-None-Match')).toBe('"abc123"')
  })

  it('reports not-modified on a 304', async () => {
    await upsertGithubToken('valid-token')
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(null, { status: 304 }),
    )

    const result = (
      await fetchGithubIssueIfChanged(ref, '"abc123"')
    )._unsafeUnwrap()

    expect(result).toEqual({ notModified: true })
  })

  it('returns the issue and its new etag on a 200', async () => {
    await upsertGithubToken('valid-token')
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          title: 'Bug: something broke',
          body: 'Steps to reproduce...',
          state: 'open',
          comments: 5,
          updated_at: '2024-08-15T11:45:00Z',
          state_reason: null,
          html_url: 'https://github.com/fohte/tq/issues/42',
        }),
        { status: 200, headers: { etag: '"def456"' } },
      ),
    )

    const result = (
      await fetchGithubIssueIfChanged(ref, '"abc123"')
    )._unsafeUnwrap()

    expect(result).toEqual({
      notModified: false,
      issue: {
        owner: 'fohte',
        repo: 'tq',
        number: 42,
        kind: 'issue',
        url: 'https://github.com/fohte/tq/issues/42',
        title: 'Bug: something broke',
        body: 'Steps to reproduce...',
        state: 'open',
        commentsCount: 5,
        githubUpdatedAt: '2024-08-15T11:45:00Z',
        stateReason: null,
      },
      etag: '"def456"',
    })
  })
})
