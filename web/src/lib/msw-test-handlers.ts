import { http, HttpResponse } from 'msw'

import { makeDescriptionTemplate } from '#components/settings/description-template-test-fixtures'

/**
 * Shared handler for the labels endpoint that CreateTaskModal fetches
 * unconditionally as a side effect of mounting, whose response content
 * doesn't affect what a story renders.
 */
export const emptyLabelsHandler = http.get('/api/labels', () =>
  HttpResponse.json([]),
)

export const descriptionTemplatesHandler = http.get(
  '/api/description-templates',
  () => HttpResponse.json([makeDescriptionTemplate()]),
)

export const descriptionTemplateHandler = http.get(
  '/api/description-templates/:name',
  ({ params }) =>
    HttpResponse.json(
      makeDescriptionTemplate({ name: String(params['name']) }),
    ),
)
