import { OAuthTokenMissingError, TokenRefreshError } from '#integrations/errors'
import { GithubApiError } from '#integrations/github/index'

// A rejected GithubApiError/TokenRefreshError (4xx / a provider-rejected
// refresh: e.g. the token lost access, or the issue/PR is gone) and a
// missing token are all normal "not currently syncable" states, not
// operational failures — skip them quietly so a disconnected or revoked
// integration doesn't spam error reporting on every sync. Anything else
// (network/parse/5xx, or a config error) is unexpected and must be
// captured. Shared by github-sync.ts and github-sync-rules.ts, which each
// add their own module-specific quiet cases on top of this.
export function isQuietProviderError(error: Error): boolean {
  if (error instanceof GithubApiError) return error.rejected
  if (error instanceof TokenRefreshError) return error.rejected
  return error instanceof OAuthTokenMissingError
}
