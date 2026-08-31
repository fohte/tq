import { http, HttpResponse } from 'msw'

/**
 * Shared handlers for endpoints that CreateTaskModal fetches as a side
 * effect of mounting (labels unconditionally, the task list whenever it's
 * given a parentId) but whose response content doesn't affect what a story
 * renders.
 */
export const emptyLabelsHandler = http.get('/api/labels', () =>
  HttpResponse.json([]),
)
export const emptyTasksHandler = http.get('/api/tasks', () =>
  HttpResponse.json([]),
)
