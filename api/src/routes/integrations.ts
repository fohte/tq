import { Hono } from 'hono'

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
    const list = await Promise.all(
      integrationProviders.map((provider) => getIntegrationSummary(provider)),
    )

    return c.json(list, 200)
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
