import { Hono } from 'hono'

import { tasksActionsApp } from '#routes/tasks/actions'
import { tasksActivityApp } from '#routes/tasks/activity'
import { tasksCrudApp } from '#routes/tasks/crud'
import { tasksGithubApp } from '#routes/tasks/github'
import { tasksSearchApp } from '#routes/tasks/search'

// Search and github routes must be registered before CRUD to prevent
// /:id from matching /search and /from-github as path parameters.
export const tasksApp = new Hono()
  .route('/', tasksSearchApp)
  .route('/', tasksGithubApp)
  .route('/', tasksCrudApp)
  .route('/', tasksActionsApp)
  .route('/', tasksActivityApp)
