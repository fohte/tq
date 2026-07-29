import { captureWithFingerprint } from '@fohte/service-kit/observability'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

import { IntegrationConfigError } from '#integrations/errors'
import {
  disconnect,
  getAuthUrl,
  getConnectionStatus,
  handleOAuthCallback,
} from '#integrations/oauth'
import {
  INTEGRATION_PROVIDER_IDS,
  integrationProviders,
} from '#integrations/registry'
import { TokenExchangeError } from '#lib/fetch-json'

const providerParamSchema = z.object({
  provider: z.enum(INTEGRATION_PROVIDER_IDS),
})

const callbackQuerySchema = z.object({
  code: z.string(),
})

export const integrationsApp = new Hono()
  .get(
    '/:provider/status',
    zValidator('param', providerParamSchema),
    async (c) => {
      const provider = integrationProviders[c.req.valid('param').provider]

      const result = await getConnectionStatus(provider)

      return result.match(
        (status) => c.json(status, 200),
        (error) => {
          captureWithFingerprint(
            error,
            `api.integrations.get-status-failed.${provider.id}`,
            { extras: { provider: provider.id } },
          )
          return c.json({ error: 'Internal server error' }, 500)
        },
      )
    },
  )
  .get('/:provider/auth-url', zValidator('param', providerParamSchema), (c) => {
    const provider = integrationProviders[c.req.valid('param').provider]

    return getAuthUrl(provider).match(
      (url) => c.json({ url }, 200),
      (error) => {
        captureWithFingerprint(
          error,
          `api.integrations.get-auth-url-failed.${provider.id}`,
          { extras: { provider: provider.id } },
        )
        return c.json({ error: 'Internal server error' }, 500)
      },
    )
  })
  .get(
    '/:provider/oauth-callback',
    zValidator('param', providerParamSchema),
    zValidator('query', callbackQuerySchema),
    async (c) => {
      const provider = integrationProviders[c.req.valid('param').provider]
      const { code } = c.req.valid('query')

      const result = await handleOAuthCallback(provider, code)

      return result.match(
        () => c.json({ message: 'Authentication successful' }, 200),
        (error) => {
          // A config error means the server itself is misconfigured, so its
          // message (which names the missing env vars) must not reach the
          // client. A rejected code is a normal OAuth-flow outcome, so
          // relaying the provider's own rejection reason back is fine.
          // Anything else (network/parse/schema failure) is unexpected and
          // must be captured rather than relayed.
          if (error instanceof IntegrationConfigError) {
            captureWithFingerprint(
              error,
              `api.integrations.oauth-callback-config-error.${provider.id}`,
              { extras: { provider: provider.id } },
            )
            return c.json({ error: 'Internal server error' }, 500)
          }
          if (error instanceof TokenExchangeError && error.rejected) {
            return c.json({ error: error.message }, 400)
          }
          captureWithFingerprint(
            error,
            `api.integrations.oauth-callback-failed.${provider.id}`,
            { extras: { provider: provider.id } },
          )
          return c.json({ error: 'Internal server error' }, 500)
        },
      )
    },
  )
  .delete(
    '/:provider/token',
    zValidator('param', providerParamSchema),
    async (c) => {
      const provider = integrationProviders[c.req.valid('param').provider]

      const result = await disconnect(provider)
      return result.match(
        () => c.json({ message: 'Disconnected' }, 200),
        () => c.json({ error: 'Internal server error' }, 500),
      )
    },
  )
