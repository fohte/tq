import '#bootstrap'

import { serve } from '@hono/node-server'

import { app } from '#app'
import { startGithubSyncPolling } from '#services/github-sync'

const port = Number(process.env['PORT']) || 3001

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Server is running on http://localhost:${String(info.port)}`)
})

startGithubSyncPolling()
