import { serve } from '@hono/node-server'

import { app } from '@api/app'

const port = Number(process.env['PORT']) || 3001

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
