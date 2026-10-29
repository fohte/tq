import { Hono } from 'hono'

import { tasksCreateApp } from '#routes/tasks/crud-create'
import { tasksUpdateApp } from '#routes/tasks/crud-update'
import { tasksDeleteApp } from '#routes/tasks/delete'
import { tasksListApp } from '#routes/tasks/list'

export const tasksCrudApp = new Hono()
  .route('/', tasksCreateApp)
  .route('/', tasksListApp)
  .route('/', tasksUpdateApp)
  .route('/', tasksDeleteApp)
