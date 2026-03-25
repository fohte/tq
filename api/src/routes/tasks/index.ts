import { tasksActionsApp } from '@api/routes/tasks/actions'
import { tasksCrudApp } from '@api/routes/tasks/crud'
import { tasksSearchApp } from '@api/routes/tasks/search'
import { tasksTreeApp } from '@api/routes/tasks/tree'
import { Hono } from 'hono'

export { taskToResponse } from '@api/routes/tasks/shared'

// Tree and search routes must be registered before CRUD to prevent
// /:id from matching /tree and /search as path parameters.
export const tasksApp = new Hono()
  .route('/', tasksTreeApp)
  .route('/', tasksSearchApp)
  .route('/', tasksCrudApp)
  .route('/', tasksActionsApp)
