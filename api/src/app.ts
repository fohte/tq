import { captureWithFingerprint } from '@fohte/service-kit/observability'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

import { calendarApp } from '#routes/calendar'
import { imagesApp } from '#routes/images'
import { integrationsApp } from '#routes/integrations'
import { labelsApp } from '#routes/labels'
import { mcpApp } from '#routes/mcp/index'
import { projectsApp } from '#routes/projects'
import { schedulesApp } from '#routes/schedules'
import { taskCommentsApp } from '#routes/task-comments'
import { taskPagesApp } from '#routes/task-pages'
import { tasksApp } from '#routes/tasks/index'

const app = new Hono()
  .use(
    '*',
    cors({
      origin: process.env['CORS_ORIGIN'] ?? '*',
    }),
  )
  .get('/health', (c) => {
    return c.json({ status: 'ok' })
  })
  .route('/api/tasks', tasksApp)
  .route('/api/tasks', taskCommentsApp)
  .route('/api/tasks/:taskId/pages', taskPagesApp)
  .route('/api/projects', projectsApp)
  .route('/api/schedule', schedulesApp)
  .route('/api/calendar', calendarApp)
  .route('/api/integrations', integrationsApp)
  .route('/api/images', imagesApp)
  .route('/api/labels', labelsApp)
  .route('/api/mcp', mcpApp)
  // Final safety net: any error that escapes a route handler without being
  // reported at its own point of failure lands here, so it's never silently
  // invisible to Sentry.
  .onError((err, c) => {
    captureWithFingerprint(err, 'api.unhandled-error', {
      extras: { method: c.req.method, path: c.req.path },
    })
    return c.json({ error: 'Internal server error' }, 500)
  })

export { app }

export type AppType = typeof app
