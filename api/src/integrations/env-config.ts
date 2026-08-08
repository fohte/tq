import { parseEnv, requireString } from '@fohte/service-kit/env'
import type { Result } from 'neverthrow'

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
  return parseEnv({
    clientId: requireString(process.env, `${prefix}_CLIENT_ID`),
    clientSecret: requireString(process.env, `${prefix}_CLIENT_SECRET`),
    redirectUri: requireString(process.env, `${prefix}_REDIRECT_URI`),
  }).mapErr((error) => new IntegrationConfigError(error.message))
}
