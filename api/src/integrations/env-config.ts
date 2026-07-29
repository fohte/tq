import { err, ok, type Result } from 'neverthrow'

import { IntegrationConfigError } from '#integrations/errors'
import type { OAuthConfig } from '#integrations/types'

/**
 * Reads `<prefix>_CLIENT_ID`/`<prefix>_CLIENT_SECRET`/`<prefix>_REDIRECT_URI`
 * from the environment. Shared by providers whose OAuth config is exactly
 * this triple (client_id/client_secret/redirect_uri env vars).
 */
export function getOAuthEnvConfig(
  prefix: string,
): Result<OAuthConfig, IntegrationConfigError> {
  const clientId = process.env[`${prefix}_CLIENT_ID`]
  const clientSecret = process.env[`${prefix}_CLIENT_SECRET`]
  const redirectUri = process.env[`${prefix}_REDIRECT_URI`]

  if (
    clientId == null ||
    clientId === '' ||
    clientSecret == null ||
    clientSecret === '' ||
    redirectUri == null ||
    redirectUri === ''
  ) {
    return err(
      new IntegrationConfigError(
        `${prefix}_CLIENT_ID, ${prefix}_CLIENT_SECRET, and ${prefix}_REDIRECT_URI environment variables are required`,
      ),
    )
  }

  return ok({ clientId, clientSecret, redirectUri })
}
