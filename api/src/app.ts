import { captureWithFingerprint } from '@fohte/service-kit/observability'
import type { Context } from 'hono'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'

import { authorMiddleware } from '#lib/author'
import { calendarApp } from '#routes/calendar'
import { githubApp } from '#routes/github'
import { githubSyncRulesApp } from '#routes/github-sync-rules'
import { imagesApp } from '#routes/images'
import { integrationsApp } from '#routes/integrations'
import { labelsApp } from '#routes/labels'
import { mcpApp } from '#routes/mcp/index'
import { projectsApp } from '#routes/projects'
import { schedulesApp } from '#routes/schedules'
import { schedulingSettingsApp } from '#routes/scheduling-settings'
import { slackApp } from '#routes/slack'
import { taskCommentsApp } from '#routes/task-comments'
import { taskGithubLinkApp } from '#routes/task-github-link'
import { taskPagesApp } from '#routes/task-pages'
import { tasksApp } from '#routes/tasks/index'

// Final safety net: any error that escapes a route handler without being
// reported at its own point of failure lands here, so it's never silently
// invisible to Sentry — except an HTTPException, whose thrower already
// chose its status and body on purpose.
export function onError(err: Error, c: Context): Response {
  if (err instanceof HTTPException) {
    return err.getResponse()
  }
  captureWithFingerprint(err, 'api.unhandled-error', {
    extras: { method: c.req.method, path: c.req.path },
  })
  return c.json({ error: 'Internal server error' }, 500)
}

const app = new Hono()
  .use(
    '*',
    cors({
      origin: process.env['CORS_ORIGIN'] ?? '*',
    }),
  )
  .use('*', authorMiddleware)
  .get('/health', (c) => {
    return c.json({ status: 'ok' })
  })
  .route('/api/tasks', tasksApp)
  .route('/api/tasks', taskCommentsApp)
  .route('/api/tasks/:taskId/pages', taskPagesApp)
  .route('/api/tasks/:taskId/github-link', taskGithubLinkApp)
  .route('/api/projects', projectsApp)
  .route('/api/schedule', schedulesApp)
  .route('/api/calendar', calendarApp)
  .route('/api/github', githubApp)
  .route('/api/github/sync-rules', githubSyncRulesApp)
  .route('/api/images', imagesApp)
  .route('/api/integrations', integrationsApp)
  .route('/api/labels', labelsApp)
  .route('/api/scheduling-settings', schedulingSettingsApp)
  .route('/api/slack', slackApp)
  .route('/api/mcp', mcpApp)
  .onError(onError)

export { app }

export type AppType = typeof app
