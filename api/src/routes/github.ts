import { captureWithFingerprint } from '@fohte/service-kit/observability'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

import {
  disconnect,
  getAuthUrl,
  getConnectionStatus,
  GithubConfigError,
  handleOAuthCallback,
  TokenExchangeError,
} from '#services/github'

const callbackQuerySchema = z.object({
  code: z.string(),
})

export const githubApp = new Hono()
  .get('/status', async (c) => {
    const result = await getConnectionStatus()

    return result.match(
      (status) => c.json(status, 200),
      (error) => {
        captureWithFingerprint(error, 'api.github.get-status-failed')
        return c.json({ error: 'Internal server error' }, 500)
      },
    )
  })
  .get('/auth-url', (c) => {
    return getAuthUrl().match(
      (url) => c.json({ url }, 200),
      (error) => {
        captureWithFingerprint(error, 'api.github.get-auth-url-failed')
        return c.json({ error: 'Internal server error' }, 500)
      },
    )
  })
  .get(
    '/oauth-callback',
    zValidator('query', callbackQuerySchema),
    async (c) => {
      const { code } = c.req.valid('query')

      const result = await handleOAuthCallback(code)

      return result.match(
        () => c.json({ message: 'Authentication successful' }, 200),
        (error) => {
          // A config error means the server itself is misconfigured, so its
          // message (which names the missing env vars) must not reach the
          // client. A rejected code is a normal OAuth-flow outcome, so
          // relaying the provider's own rejection reason back is fine.
          // Anything else (network/parse/schema failure) is unexpected and
          // must be captured rather than relayed.
          if (error instanceof GithubConfigError) {
            captureWithFingerprint(
              error,
              'api.github.oauth-callback-config-error',
            )
            return c.json({ error: 'Internal server error' }, 500)
          }
          if (error instanceof TokenExchangeError && error.rejected) {
            return c.json({ error: error.message }, 400)
          }
          captureWithFingerprint(error, 'api.github.oauth-callback-failed')
          return c.json({ error: 'Internal server error' }, 500)
        },
      )
    },
  )
  .delete('/token', async (c) => {
    const result = await disconnect()
    return result.match(
      () => c.json({ message: 'Disconnected' }, 200),
      () => c.json({ error: 'Internal server error' }, 500),
    )
  })
