import { captureWithFingerprint } from '@fohte/service-kit/observability'
import { Hono } from 'hono'
import { ResultAsync } from 'neverthrow'

import { getIntegrationSummary } from '#integrations/oauth'
import {
  findIntegrationProvider,
  integrationProviders,
} from '#integrations/registry'
import {
  handleDisconnect,
  handleGetAuthUrl,
} from '#routes/integration-handlers'

export const integrationsApp = new Hono()
  .get('/', async (c) => {
    const result = await ResultAsync.combine(
      integrationProviders.map((provider) => getIntegrationSummary(provider)),
    )

    return result.match(
      (list) => c.json(list, 200),
      (error) => {
        captureWithFingerprint(error, 'api.integrations.list-failed')
        return c.json({ error: 'Internal server error' }, 500)
      },
    )
  })
  .get('/:id/auth-url', (c) => {
    const provider = findIntegrationProvider(c.req.param('id'))
    if (provider == null) {
      return c.json({ error: 'Not found' }, 404)
    }

    return handleGetAuthUrl(c, provider, `integrations.${provider.id}`)
  })
  .delete('/:id', async (c) => {
    const provider = findIntegrationProvider(c.req.param('id'))
    if (provider == null) {
      return c.json({ error: 'Not found' }, 404)
    }

    return handleDisconnect(c, provider)
  })
