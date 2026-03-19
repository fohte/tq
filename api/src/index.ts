import { app } from '@api/app'
import { serve } from '@hono/node-server'

const port = Number(process.env['PORT']) || 3001

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
