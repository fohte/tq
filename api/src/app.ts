import { Hono } from 'hono'

import { calendarApp } from '@/routes/calendar'
import { imagesApp } from '@/routes/images'
import { projectsApp } from '@/routes/projects'
import { schedulesApp } from '@/routes/schedules'
import { tasksApp } from '@/routes/tasks'

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
