import { Hono } from 'hono'

import { tasksActionsApp } from '#routes/tasks/actions'
import { tasksActivityApp } from '#routes/tasks/activity'
import { tasksCrudApp } from '#routes/tasks/crud'
import { tasksGithubApp } from '#routes/tasks/github'
import { tasksSearchApp } from '#routes/tasks/search'
import { tasksTreeApp } from '#routes/tasks/tree'

export { taskToResponse } from '#routes/tasks/shared'

// Tree, search, and github routes must be registered before CRUD to prevent
// /:id from matching /tree, /search, and /from-github as path parameters.
export const tasksApp = new Hono()
  .route('/', tasksTreeApp)
  .route('/', tasksSearchApp)
  .route('/', tasksGithubApp)
  .route('/', tasksCrudApp)
  .route('/', tasksActionsApp)
  .route('/', tasksActivityApp)
