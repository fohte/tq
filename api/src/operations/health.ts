import { z } from 'zod'

import { defineOperation, requestJson } from '#operations/types'

export const healthOperations = [
  defineOperation(z.object({}), {
    path: ['health'],
    description: 'Check API connectivity',
    positionalArgs: [],
    kind: 'read',
    routes: ['GET /health'],
    cli: {
      group: { order: 11 },
      output: { kind: 'json' },
    },
    run: (client) => requestJson(client.health.$get()),
  }),
] as const
