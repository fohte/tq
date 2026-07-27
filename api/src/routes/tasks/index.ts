import { Hono } from 'hono'

import { tasksActionsApp } from '#routes/tasks/actions'
import { tasksCrudApp } from '#routes/tasks/crud'
import { tasksSearchApp } from '#routes/tasks/search'
import { tasksTreeApp } from '#routes/tasks/tree'

export { taskToResponse } from '#routes/tasks/shared'

// Tree and search routes must be registered before CRUD to prevent
// /:id from matching /tree and /search as path parameters.
export const tasksApp = new Hono()
  .route('/', tasksTreeApp)
  .route('/', tasksSearchApp)
  .route('/', tasksCrudApp)
  .route('/', tasksActionsApp)
