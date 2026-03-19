import { calendarApp } from '@api/routes/calendar'
import { imagesApp } from '@api/routes/images'
import { projectsApp } from '@api/routes/projects'
import { schedulesApp } from '@api/routes/schedules'
import { tasksApp } from '@api/routes/tasks'
import { Hono } from 'hono'

const app = new Hono()
  .get('/health', (c) => {
    return c.json({ status: 'ok' })
  })
  .route('/api/tasks', tasksApp)
  .route('/api/projects', projectsApp)
  .route('/api/schedule', schedulesApp)
  .route('/api/calendar', calendarApp)
  .route('/api/images', imagesApp)

export { app }

export type AppType = typeof app
