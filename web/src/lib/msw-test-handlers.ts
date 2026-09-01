import { http, HttpResponse } from 'msw'

/**
 * Shared handler for the labels endpoint that CreateTaskModal fetches
 * unconditionally as a side effect of mounting, whose response content
 * doesn't affect what a story renders.
 */
export const emptyLabelsHandler = http.get('/api/labels', () =>
  HttpResponse.json([]),
)
