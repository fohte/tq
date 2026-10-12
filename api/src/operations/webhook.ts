import { err, ok } from 'neverthrow'
import { z } from 'zod'

import { encodePathSegment } from '#operations/path-segment'
import {
  defineOperation,
  requestJson,
  requestNoContent,
} from '#operations/types'
import {
  createWebhookSubscriptionSchema,
  webhookSubscriptionIdSchema,
} from '#schemas/webhook'

const surface = {
  only: 'cli',
  reason: 'Webhook subscriptions are managed through the command-line client.',
} as const

const createWebhookInputSchema = z.object({
  url: createWebhookSubscriptionSchema.shape.url.describe(
    'HTTP or HTTPS URL to receive task status events.',
  ),
  secret: createWebhookSubscriptionSchema.shape.secret.describe(
    'Signing secret. Set TQ_WEBHOOK_SECRET to avoid passing it as an argument.',
  ),
})

function mapWebhookSecret(
  input: Record<string, unknown>,
  options: Record<string, unknown>,
) {
  const secret = options['secret'] ?? process.env['TQ_WEBHOOK_SECRET']
  return typeof secret === 'string' && secret.length > 0
    ? ok({ ...input, secret })
    : err(new Error('Provide --secret or set TQ_WEBHOOK_SECRET.'))
}

export const webhookOperations = [
  defineOperation(createWebhookInputSchema, {
    path: ['webhook', 'create'],
    description: 'Register an outgoing webhook subscription.',
    positionalArgs: ['url'],
    kind: 'write',
    routes: ['POST /api/webhooks'],
    surface,
    cli: {
      group: {
        description: 'Manage outgoing webhook subscriptions',
        order: 20,
      },
      customOptions: [
        {
          flags: '--secret <secret>',
          description:
            'Signing secret (or set TQ_WEBHOOK_SECRET to avoid a process argument)',
        },
      ],
      mapInput: mapWebhookSecret,
      output: { kind: 'json' },
    },
    run: (client, json) => requestJson(client.api.webhooks.$post({ json })),
  }),
  defineOperation(z.object({}), {
    path: ['webhook', 'list'],
    description: 'List outgoing webhook subscriptions.',
    positionalArgs: [],
    kind: 'read',
    routes: ['GET /api/webhooks'],
    surface,
    cli: { output: { kind: 'json' } },
    run: (client) => requestJson(client.api.webhooks.$get()),
  }),
  defineOperation(webhookSubscriptionIdSchema, {
    path: ['webhook', 'delete'],
    description: 'Delete an outgoing webhook subscription by id.',
    positionalArgs: ['id'],
    kind: 'delete',
    routes: ['DELETE /api/webhooks/:id'],
    surface,
    cli: { output: { kind: 'json' } },
    run: (client, { id }) =>
      requestNoContent(
        client.api.webhooks[':id'].$delete({
          param: { id: encodePathSegment(id) },
        }),
      ).map(() => ({ deleted: true, id })),
  }),
] as const
