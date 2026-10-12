import { createHmac } from 'node:crypto'

import { captureWithFingerprint } from '@fohte/service-kit/observability'
import { errAsync, okAsync, ResultAsync } from 'neverthrow'

import { db } from '#db/connection'
import { tasks, webhookSubscriptions } from '#db/schema'
import type {
  DuplicateTaskSummary,
  TaskStatusChangedWebhookEvent,
} from '#schemas/webhook'

function asError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause))
}

export async function dispatchTaskStatusChangedWebhook(
  task: Pick<
    typeof tasks.$inferSelect,
    'id' | 'number' | 'status' | 'statusReason' | 'updatedAt'
  >,
  duplicateOfTask: DuplicateTaskSummary | null,
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

  const event: TaskStatusChangedWebhookEvent = {
    event: 'task.status_changed',
    occurredAt: task.updatedAt.toISOString(),
    task: {
      id: task.id,
      number: task.number,
      status: task.status,
      statusReason: task.statusReason,
      ...(duplicateOfTask == null ? {} : { duplicateOfTask }),
    },
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
