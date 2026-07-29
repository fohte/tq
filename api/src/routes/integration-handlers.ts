import { captureWithFingerprint } from '@fohte/service-kit/observability'
import type { Context } from 'hono'
import { z } from 'zod'

import { IntegrationConfigError } from '#integrations/errors'
import {
  disconnect,
  getAuthUrl,
  getConnectionStatus,
  handleOAuthCallback,
} from '#integrations/oauth'
import type { IntegrationProvider } from '#integrations/types'
import { TokenExchangeError } from '#lib/fetch-json'

// Shared route-level wiring (Result -> HTTP status/body, Sentry capture) for
// the connection endpoints every integration exposes. Each provider keeps
// its own route file/URL paths — see routes/calendar.ts and routes/github.ts
// — since those paths are external contracts (e.g. registered as the OAuth
// App's callback URL) that must not shift as a side effect of this sharing.

export const callbackQuerySchema = z.object({
  code: z.string(),
})
export async function handleConnectionStatus(
  c: Context,
  provider: IntegrationProvider,
  fingerprintPrefix: string,
) {
  const result = await getConnectionStatus(provider)

  return result.match(
    (status) => c.json(status, 200),
    (error) => {
      captureWithFingerprint(
        error,
        `api.${fingerprintPrefix}.get-status-failed`,
      )
      return c.json({ error: 'Internal server error' }, 500)
    },
  )
}

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

export async function handleDisconnect(
  c: Context,
  provider: IntegrationProvider,
) {
  const result = await disconnect(provider)
  return result.match(
    () => c.json({ message: 'Disconnected' }, 200),
    () => c.json({ error: 'Internal server error' }, 500),
  )
}
