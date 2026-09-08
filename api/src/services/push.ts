import { captureWithFingerprint } from '@fohte/service-kit/observability'
import { eq, inArray } from 'drizzle-orm'
import { ResultAsync } from 'neverthrow'
import webPush from 'web-push'

import { db } from '#db/connection'
import { pushSubscriptions } from '#db/schema'
import { APP_DOMAIN, VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY } from '#env'

// web-push is CommonJS without statically detectable named exports in Node
// ESM; import the default export and destructure.
const { sendNotification, WebPushError } = webPush

// RFC 8292 wants the VAPID JWT's `sub` to be a mailto: or https: URI a push
// service can use to reach whoever is sending, which tq's own origin is.
const VAPID_SUBJECT = `https://${APP_DOMAIN}`

// Shape the service worker's `push` handler reads out of `event.data.json()`.
export interface PushPayload {
  title: string
  body: string
  /** Collapses repeated notifications about one task into a single one. */
  taskId?: string
  /** Where a click on the notification lands; the worker defaults to `/`. */
  url?: string
}

export interface PushDeliveryReport {
  sent: number
  removed: number
  failed: number
}

/**
 * Which devices to reach: a single one for a test send, or every device a
 * context is set up on — a work notification must not light up a personal
 * machine.
 */
export type PushTarget = { endpoint: string } | { context: 'work' | 'personal' }

// A push service answers 404/410 once the browser has dropped a subscription
// (permission revoked, app reinstalled, ...). Such a row can never succeed
// again, so it is deleted instead of reported.
const GONE_STATUS_CODES = [404, 410]

type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect

/**
 * Whether a VAPID keypair is available. Outside production the values fall
 * back to empty strings (see #env), and every send would fail inside
 * `web-push` with an opaque error.
 */
export function isPushConfigured(): boolean {
  return VAPID_PUBLIC_KEY !== '' && VAPID_PRIVATE_KEY !== ''
}

function isGone(error: Error): boolean {
  return (
    error instanceof WebPushError &&
    GONE_STATUS_CODES.includes(error.statusCode)
  )
}

function send(
  subscription: PushSubscriptionRow,
  payload: PushPayload,
): ResultAsync<void, Error> {
  return ResultAsync.fromPromise(
    sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
      {
        vapidDetails: {
          subject: VAPID_SUBJECT,
          publicKey: VAPID_PUBLIC_KEY,
          privateKey: VAPID_PRIVATE_KEY,
        },
      },
    ),
    (error) => (error instanceof Error ? error : new Error(String(error))),
  ).map(() => undefined)
}

/**
 * Deliver a notification to the targeted subscriptions, dropping the ones the
 * push service reports as gone and recording when each one last worked.
 */
export async function sendPush(
  target: PushTarget,
  payload: PushPayload,
): Promise<PushDeliveryReport> {
  const subscriptions = await db
    .select()
    .from(pushSubscriptions)
    .where(
      'endpoint' in target
        ? eq(pushSubscriptions.endpoint, target.endpoint)
        : eq(pushSubscriptions.context, target.context),
    )

  const outcomes = await Promise.all(
    subscriptions.map(async (subscription) => ({
      subscription,
      result: await send(subscription, payload),
    })),
  )

  const sentIds: string[] = []
  const goneIds: string[] = []
  let failed = 0

  for (const { subscription, result } of outcomes) {
    if (result.isOk()) {
      sentIds.push(subscription.id)
    } else if (isGone(result.error)) {
      goneIds.push(subscription.id)
    } else {
      failed += 1
      captureWithFingerprint(result.error, 'api.push.send-failed', {
        extras: { subscriptionId: subscription.id },
      })
    }
  }

  if (sentIds.length > 0) {
    await db
      .update(pushSubscriptions)
      .set({ lastSuccessAt: new Date() })
      .where(inArray(pushSubscriptions.id, sentIds))
  }

  if (goneIds.length > 0) {
    await db
      .delete(pushSubscriptions)
      .where(inArray(pushSubscriptions.id, goneIds))
  }

  return { sent: sentIds.length, removed: goneIds.length, failed }
}
