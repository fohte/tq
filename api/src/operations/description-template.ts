import { z } from 'zod'

import { encodePathSegment } from '#operations/path-segment'
import { defineOperation, requestJson } from '#operations/types'
import { descriptionTemplateParamsSchema } from '#schemas/description-template'

export const descriptionTemplateOperations = [
  defineOperation(z.object({}), {
    path: ['description-template', 'list'],
    description: 'List description templates available for task descriptions.',
    positionalArgs: [],
    kind: 'read',
    routes: ['GET /api/description-templates'],
    cli: {
      group: { description: 'Browse description templates', order: 16 },
      output: { kind: 'json' },
    },
    run: (client) => requestJson(client.api['description-templates'].$get()),
  }),
  defineOperation(descriptionTemplateParamsSchema, {
    path: ['description-template', 'get'],
    description: 'Get a description template by name.',
    positionalArgs: ['name'],
    kind: 'read',
    routes: ['GET /api/description-templates/:name'],
    cli: { output: { kind: 'json' } },
    run: (client, { name }) =>
      requestJson(
        client.api['description-templates'][':name'].$get({
          param: { name: encodePathSegment(name) },
        }),
      ),
  }),
] as const
