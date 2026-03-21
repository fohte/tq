import { calendarApp } from '@api/routes/calendar'
import { imagesApp } from '@api/routes/images'
import { labelsApp } from '@api/routes/labels'
import { projectsApp } from '@api/routes/projects'
import { schedulesApp } from '@api/routes/schedules'
import { taskPagesApp } from '@api/routes/task-pages'
import { tasksApp } from '@api/routes/tasks'
import { Hono } from 'hono'

const app = new Hono()
  .get('/health', (c) => {
    return c.json({ status: 'ok' })
  })
  .route('/api/tasks', tasksApp)
  .route('/api/tasks/:taskId/pages', taskPagesApp)
  .route('/api/projects', projectsApp)
  .route('/api/schedule', schedulesApp)
  .route('/api/calendar', calendarApp)
  .route('/api/images', imagesApp)
  .route('/api/labels', labelsApp)

export { app }

export type AppType = typeof app
