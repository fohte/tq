import { z } from 'zod'

import { defineOperation, requestJson } from '#operations/types'

const resolveSlackInputSchema = z.object({ url: z.string().min(1) })

export const slackOperations = [
  defineOperation(resolveSlackInputSchema, {
    path: ['slack', 'resolve'],
    description: 'Resolve a Slack permalink URL to a message preview',
    positionalArgs: ['url'],
    kind: 'read',
    routes: ['POST /api/slack/resolve'],
    cli: {
      group: { description: 'Manage Slack links', order: 10 },
      output: { kind: 'json' },
    },
    run: (client, { url }) =>
      requestJson(client.api.slack.resolve.$post({ json: { url } })),
  }),
] as const
