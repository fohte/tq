import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sendNotification, WebPushError } from 'web-push'

import { app } from '#app'
import { db } from '#db/connection'
import { pushSubscriptions } from '#db/schema'
import { assertDefined, jsonBody, setupTestDb } from '#testing'

// Only the network call is stubbed; WebPushError stays the real class so the
// service's status-code handling runs against the errors web-push throws.
vi.mock('web-push', async (importOriginal) => ({
  ...(await importOriginal<typeof import('web-push')>()),
  sendNotification: vi.fn(),
}))

setupTestDb()

beforeEach(() => {
  vi.mocked(sendNotification).mockReset().mockResolvedValue({
    statusCode: 201,
    body: '',
    headers: {},
  })
})

interface PushSubscriptionResponse {
  id: string
  endpoint: string
  label: string | null
  context: 'work' | 'personal'
  createdAt: string
  lastSuccessAt: string | null
}

const ENDPOINT = 'https://push.example.com/subscription/abc'
const OTHER_ENDPOINT = 'https://push.example.com/subscription/xyz'

const TEST_PAYLOAD = JSON.stringify({
  title: 'tq',
  body: 'Test notification',
})

const VAPID_DETAILS = {
  vapidDetails: {
    // Derived from APP_DOMAIN, which falls back to the Vite dev origin in test.
    subject: 'https://localhost:5173',
    publicKey: 'test-vapid-public-key',
    privateKey: 'test-vapid-private-key',
  },
}

function subscribe(body: Record<string, unknown>) {
  return app.request('/api/push/subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function subscriptionBody(
  endpoint: string,
  overrides: { label?: string; context?: 'work' | 'personal' } = {},
) {
  return {
    endpoint,
    keys: { p256dh: 'p256dh-key', auth: 'auth-secret' },
    context: overrides.context ?? 'personal',
    ...(overrides.label == null ? {} : { label: overrides.label }),
  }
}

function unsubscribe(endpoint: string) {
  return app.request('/api/push/subscriptions', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
  })
}

function testSend(endpoint: string) {
  return app.request('/api/push/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
  })
}

function normalizeSubscription(subscription: PushSubscriptionResponse) {
  return {
    ...subscription,
    createdAt: 'DATE',
    lastSuccessAt: subscription.lastSuccessAt === null ? null : 'DATE',
  }
}

// Rows come back in no particular order, and their created_at is the test
// transaction's timestamp, so sort on the only column that differs.
async function storedSubscriptions() {
  const rows = await db.select().from(pushSubscriptions)
  return rows
    .map((row) => ({
      endpoint: row.endpoint,
      p256dh: row.p256dh,
      auth: row.auth,
      label: row.label,
      context: row.context,
      lastSuccessAt: row.lastSuccessAt === null ? null : 'DATE',
    }))
    .sort((a, b) => a.endpoint.localeCompare(b.endpoint))
}

describe('push API', () => {
  describe('GET /api/push/vapid-public-key', () => {
    it('returns the configured public key', async () => {
      const res = await app.request('/api/push/vapid-public-key')

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ publicKey: 'test-vapid-public-key' })
    })
  })

  describe('POST /api/push/subscriptions', () => {
    it('registers a subscription', async () => {
      const res = await subscribe(
        subscriptionBody(ENDPOINT, { label: 'iPhone', context: 'work' }),
      )

      expect(res.status).toBe(200)
      const body = await jsonBody<PushSubscriptionResponse>(res)
      assertDefined(body.id)
      expect(normalizeSubscription(body)).toEqual({
        id: body.id,
        endpoint: ENDPOINT,
        label: 'iPhone',
        context: 'work',
        createdAt: 'DATE',
        lastSuccessAt: null,
      })

      expect(await storedSubscriptions()).toEqual([
        {
          endpoint: ENDPOINT,
          p256dh: 'p256dh-key',
          auth: 'auth-secret',
          label: 'iPhone',
          context: 'work',
          lastSuccessAt: null,
        },
      ])
    })

    it('updates the existing row when the same endpoint subscribes again', async () => {
      const first = await jsonBody<PushSubscriptionResponse>(
        await subscribe(subscriptionBody(ENDPOINT, { label: 'iPhone' })),
      )

      const res = await subscribe({
        endpoint: ENDPOINT,
        keys: { p256dh: 'rotated-p256dh', auth: 'rotated-auth' },
        label: 'iPad',
        context: 'work',
      })

      expect(res.status).toBe(200)
      const body = await jsonBody<PushSubscriptionResponse>(res)
      expect(normalizeSubscription(body)).toEqual({
        id: first.id,
        endpoint: ENDPOINT,
        label: 'iPad',
        context: 'work',
        createdAt: 'DATE',
        lastSuccessAt: null,
      })

      expect(await storedSubscriptions()).toEqual([
        {
          endpoint: ENDPOINT,
          p256dh: 'rotated-p256dh',
          auth: 'rotated-auth',
          label: 'iPad',
          context: 'work',
          lastSuccessAt: null,
        },
      ])
    })

    it('keeps the stored label when the re-subscribe carries none', async () => {
      await subscribe(subscriptionBody(ENDPOINT, { label: 'iPhone' }))

      await subscribe(subscriptionBody(ENDPOINT))

      expect(await storedSubscriptions()).toEqual([
        {
          endpoint: ENDPOINT,
          p256dh: 'p256dh-key',
          auth: 'auth-secret',
          label: 'iPhone',
          context: 'personal',
          lastSuccessAt: null,
        },
      ])
    })

    it('returns 400 for a malformed subscription', async () => {
      const res = await subscribe({ endpoint: 'not-a-url', keys: {} })

      expect(res.status).toBe(400)
    })

    it('returns 400 when the context is missing', async () => {
      const res = await subscribe({
        endpoint: ENDPOINT,
        keys: { p256dh: 'p256dh-key', auth: 'auth-secret' },
      })

      expect(res.status).toBe(400)
    })
  })

  describe('DELETE /api/push/subscriptions', () => {
    it('removes the subscription with the given endpoint', async () => {
      await subscribe(subscriptionBody(ENDPOINT))
      await subscribe(subscriptionBody(OTHER_ENDPOINT))

      const res = await unsubscribe(ENDPOINT)

      expect(res.status).toBe(204)
      expect(await storedSubscriptions()).toEqual([
        {
          endpoint: OTHER_ENDPOINT,
          p256dh: 'p256dh-key',
          auth: 'auth-secret',
          label: null,
          context: 'personal',
          lastSuccessAt: null,
        },
      ])
    })

    it('returns 204 for an endpoint that is not registered', async () => {
      const res = await unsubscribe(ENDPOINT)

      expect(res.status).toBe(204)
      expect(await storedSubscriptions()).toEqual([])
    })
  })

  describe('POST /api/push/test', () => {
    it('sends only to the endpoint it was given', async () => {
      await subscribe(subscriptionBody(ENDPOINT))
      await subscribe(subscriptionBody(OTHER_ENDPOINT))

      const res = await testSend(ENDPOINT)

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ sent: 1, removed: 0, failed: 0 })

      expect(vi.mocked(sendNotification).mock.calls).toEqual([
        [
          {
            endpoint: ENDPOINT,
            keys: { p256dh: 'p256dh-key', auth: 'auth-secret' },
          },
          TEST_PAYLOAD,
          VAPID_DETAILS,
        ],
      ])

      expect(await storedSubscriptions()).toEqual([
        {
          endpoint: ENDPOINT,
          p256dh: 'p256dh-key',
          auth: 'auth-secret',
          label: null,
          context: 'personal',
          lastSuccessAt: 'DATE',
        },
        {
          endpoint: OTHER_ENDPOINT,
          p256dh: 'p256dh-key',
          auth: 'auth-secret',
          label: null,
          context: 'personal',
          lastSuccessAt: null,
        },
      ])
    })

    it('reports nothing sent for an endpoint that is not registered', async () => {
      const res = await testSend(ENDPOINT)

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ sent: 0, removed: 0, failed: 0 })
      expect(vi.mocked(sendNotification).mock.calls).toEqual([])
    })

    it.each([404, 410])(
      'deletes a subscription the push service reports as gone (%i)',
      async (statusCode) => {
        await subscribe(subscriptionBody(ENDPOINT))
        await subscribe(subscriptionBody(OTHER_ENDPOINT))
        vi.mocked(sendNotification).mockRejectedValue(
          new WebPushError('gone', statusCode, {}, '', ENDPOINT),
        )

        const res = await testSend(ENDPOINT)

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ sent: 0, removed: 1, failed: 0 })

        expect(await storedSubscriptions()).toEqual([
          {
            endpoint: OTHER_ENDPOINT,
            p256dh: 'p256dh-key',
            auth: 'auth-secret',
            label: null,
            context: 'personal',
            lastSuccessAt: null,
          },
        ])
      },
    )

    it('keeps a subscription whose delivery failed for another reason', async () => {
      await subscribe(subscriptionBody(ENDPOINT))
      vi.mocked(sendNotification).mockRejectedValue(
        new WebPushError('server error', 500, {}, '', ENDPOINT),
      )

      const res = await testSend(ENDPOINT)

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ sent: 0, removed: 0, failed: 1 })

      expect(await storedSubscriptions()).toEqual([
        {
          endpoint: ENDPOINT,
          p256dh: 'p256dh-key',
          auth: 'auth-secret',
          label: null,
          context: 'personal',
          lastSuccessAt: null,
        },
      ])
    })
  })
})
