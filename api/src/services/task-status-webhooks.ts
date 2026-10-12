import { createHmac } from 'node:crypto'

import { captureWithFingerprint } from '@fohte/service-kit/observability'
import { errAsync, okAsync, ResultAsync } from 'neverthrow'

import { db } from '#db/connection'
import { webhookSubscriptions } from '#db/schema'
import type { TaskStatusChangedWebhookEvent } from '#schemas/webhook'

function asError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause))
}

export async function dispatchTaskStatusChangedWebhook(
  event: TaskStatusChangedWebhookEvent,
): Promise<void> {
  const subscriptionsResult = await ResultAsync.fromPromise(
    db.select().from(webhookSubscriptions),
    asError,
  )

  if (subscriptionsResult.isErr()) {
    captureWithFingerprint(subscriptionsResult.error, [
      'api.outgoing-webhook.subscription-query',
    ])
    return
  }

  const body = JSON.stringify(event)
  const deliveries = await Promise.all(
    subscriptionsResult.value.map(async (subscription) => {
      const signature = createHmac('sha256', subscription.secret)
        .update(body)
        .digest('hex')
      const result = await ResultAsync.fromPromise(
        fetch(subscription.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Tq-Signature-256': `sha256=${signature}`,
          },
          body,
          signal: AbortSignal.timeout(5000),
        }),
        asError,
      ).andThen((response) =>
        response.ok
          ? okAsync(undefined)
          : errAsync(
              new Error(`Webhook returned HTTP ${String(response.status)}`),
            ),
      )

      return { id: subscription.id, result }
    }),
  )

  for (const { id, result } of deliveries) {
    result.match(
      () => undefined,
      (error) => {
        captureWithFingerprint(error, ['api.outgoing-webhook.delivery'], {
          extras: { subscriptionId: id },
        })
      },
    )
  }
}
