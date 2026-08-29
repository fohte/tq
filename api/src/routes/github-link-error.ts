import { captureWithFingerprint } from '@fohte/service-kit/observability'
import type { Context } from 'hono'

import {
  IntegrationConfigError,
  OAuthTokenMissingError,
  TokenRefreshError,
} from '#integrations/errors'
import { GithubApiError } from '#integrations/github/index'
import { InvalidGithubUrlError } from '#integrations/github/issues'
import {
  GithubLinkNotFoundError,
  GithubResourceAlreadyLinkedError,
  TaskNotFoundError,
} from '#services/task-github-links'

// Shared route-level error -> HTTP status/body mapping for the GitHub link
// endpoints (routes/github.ts's /resolve, routes/tasks/github.ts, and
// routes/task-github-link.ts), which all surface the same service-layer
// error union.
export function githubLinkErrorResponse(
  c: Context,
  error: Error,
  fingerprintPrefix: string,
) {
  if (error instanceof InvalidGithubUrlError) {
    return c.json({ error: error.message }, 400)
  }
  if (
    error instanceof TaskNotFoundError ||
    error instanceof GithubLinkNotFoundError
  ) {
    return c.json({ error: error.message }, 404)
  }
  if (error instanceof GithubResourceAlreadyLinkedError) {
    return c.json(
      { error: error.message, linkedTaskId: error.linkedTaskId },
      409,
    )
  }
  // No GitHub connection: client-actionable (connect GitHub first), safe to
  // relay directly.
  if (error instanceof OAuthTokenMissingError) {
    return c.json({ error: error.message }, 400)
  }
  // A 4xx from GitHub itself (issue/PR not found or inaccessible).
  if (error instanceof GithubApiError && error.rejected) {
    return c.json({ error: 'GitHub issue or pull request not found' }, 404)
  }
  // The stored token was revoked; the user must reconnect.
  if (error instanceof TokenRefreshError && error.rejected) {
    return c.json({ error: error.message }, 400)
  }
  if (error instanceof IntegrationConfigError) {
    captureWithFingerprint(error, `api.${fingerprintPrefix}.config-error`)
    return c.json({ error: 'Internal server error' }, 500)
  }
  captureWithFingerprint(error, `api.${fingerprintPrefix}.failed`)
  return c.json({ error: 'Internal server error' }, 500)
}
