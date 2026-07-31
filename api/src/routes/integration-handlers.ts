import { captureWithFingerprint } from '@fohte/service-kit/observability'
import type { Context } from 'hono'
import { z } from 'zod'

import { IntegrationConfigError } from '#integrations/errors'
import {
  disconnectAccount,
  getAuthUrl,
  handleOAuthCallback,
} from '#integrations/oauth'
import type { IntegrationProvider } from '#integrations/types'
import { TokenExchangeError } from '#lib/fetch-json'

// Shared route-level wiring (Result -> HTTP status/body, Sentry capture) for
// the connection endpoints every integration exposes. Status/auth-url/
// disconnect are exposed generically through routes/integrations.ts; the
// OAuth callback stays in each provider's own route file (routes/calendar.ts,
// routes/github.ts) since its URL is an external contract (e.g. registered
// as the OAuth App's callback URL) that must not shift as a side effect of
// this sharing.

export const callbackQuerySchema = z.object({
  code: z.string(),
})

export function handleGetAuthUrl(
  c: Context,
  provider: IntegrationProvider,
  fingerprintPrefix: string,
) {
  return getAuthUrl(provider).match(
    (url) => c.json({ url }, 200),
    (error) => {
      captureWithFingerprint(
        error,
        `api.${fingerprintPrefix}.get-auth-url-failed`,
      )
      return c.json({ error: 'Internal server error' }, 500)
    },
  )
}

export async function handleOAuthCallbackRoute(
  c: Context,
  provider: IntegrationProvider,
  code: string,
  fingerprintPrefix: string,
) {
  const result = await handleOAuthCallback(provider, code)

  return result.match(
    () => c.json({ message: 'Authentication successful' }, 200),
    (error) => {
      // A config error means the server itself is misconfigured, so its
      // message (which names the missing env vars) must not reach the
      // client. A rejected code is a normal OAuth-flow outcome, so relaying
      // the provider's own rejection reason back is fine. Anything else
      // (network/parse/schema failure) is unexpected and must be captured
      // rather than relayed.
      if (error instanceof IntegrationConfigError) {
        captureWithFingerprint(
          error,
          `api.${fingerprintPrefix}.oauth-callback-config-error`,
        )
        return c.json({ error: 'Internal server error' }, 500)
      }
      if (error instanceof TokenExchangeError && error.rejected) {
        return c.json({ error: error.message }, 400)
      }
      captureWithFingerprint(
        error,
        `api.${fingerprintPrefix}.oauth-callback-failed`,
      )
      return c.json({ error: 'Internal server error' }, 500)
    },
  )
}

export async function handleDisconnectAccount(
  c: Context,
  provider: IntegrationProvider,
  accountId: string,
) {
  const result = await disconnectAccount(provider, accountId)
  return result.match(
    (deleted) =>
      deleted
        ? c.json({ message: 'Disconnected' }, 200)
        : c.json({ error: 'Not found' }, 404),
    () => c.json({ error: 'Internal server error' }, 500),
  )
}
