import { createHmac } from 'node:crypto'

import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { app } from '#app'
import { db } from '#db/connection'
import { tasks } from '#db/schema'
import { createTask } from '#routes/tasks/testing'
import { taskStatusChangedWebhookEventSchema } from '#schemas/webhook'
import { jsonBody, setupTestDb } from '#testing'

setupTestDb()

afterEach(() => {
  vi.restoreAllMocks()
})

async function createSubscription(url: string, secret: string) {
  return app.request('/api/webhooks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, secret }),
  })
}

function normalizeSubscription(value: {
  id: string
  url: string
  createdAt: string
}) {
  return { id: 'ID', url: value.url, createdAt: 'CREATED_AT' }
}

function signature(secret: string, event: unknown) {
  return `sha256=${createHmac('sha256', secret)
    .update(JSON.stringify(event))
    .digest('hex')}`
}

describe('webhook subscriptions API', () => {
  it('creates, lists without exposing secrets, and deletes subscriptions', async () => {
    const url = 'https://hooks.example.invalid/tq'
    const secret = 'test-webhook-secret'
    const createResponse = await createSubscription(url, secret)
    const created = await jsonBody<{
      id: string
      url: string
      createdAt: string
      secret?: string
    }>(createResponse)
    const listResponse = await app.request('/api/webhooks')
    const listed = await jsonBody<
      {
        id: string
        url: string
        createdAt: string
        secret?: string
      }[]
    >(listResponse)
    const deleteResponse = await app.request(`/api/webhooks/${created.id}`, {
      method: 'DELETE',
    })
    const finalListResponse = await app.request('/api/webhooks')
    const finalList = await finalListResponse.json()

    const subscriptionSnapshot = () => ({
      createStatus: createResponse.status,
      created: normalizeSubscription(created),
      createdIncludesSecret: Object.hasOwn(created, 'secret'),
      listStatus: listResponse.status,
      listed: listed.map(normalizeSubscription),
      listedIncludesSecret: listed.some((subscription) =>
        Object.hasOwn(subscription, 'secret'),
      ),
      deleteStatus: deleteResponse.status,
      finalListStatus: finalListResponse.status,
      finalList,
    })

    expect(subscriptionSnapshot()).toEqual({
      createStatus: 201,
      created: { id: 'ID', url, createdAt: 'CREATED_AT' },
      createdIncludesSecret: false,
      listStatus: 200,
      listed: [{ id: 'ID', url, createdAt: 'CREATED_AT' }],
      listedIncludesSecret: false,
      deleteStatus: 204,
      finalListStatus: 200,
      finalList: [],
    })
  })

  it('rejects subscription URLs that do not use HTTP or HTTPS', async () => {
    const response = await createSubscription(
      'ftp://hooks.example.invalid/tq',
      'secret',
    )
    const body = await jsonBody<{
      success: boolean
      error: { name: string; message: string }
    }>(response)

    const validationSnapshot = () => ({
      status: response.status,
      success: body.success,
      errorName: body.error.name,
      issues: JSON.parse(body.error.message) as unknown,
    })

    expect(validationSnapshot()).toEqual({
      status: 400,
      success: false,
      errorName: 'ZodError',
      issues: [
        {
          code: 'custom',
          path: ['url'],
          message: 'URL must use HTTP or HTTPS',
        },
      ],
    })
  })
})

describe('task status webhooks', () => {
  it('signs status changes, includes duplicate targets, and skips unchanged status', async () => {
    const subscriptions = [
      {
        url: 'https://hooks.example.invalid/first',
        secret: 'test-secret-first',
      },
      {
        url: 'https://hooks.example.invalid/second',
        secret: 'test-secret-second',
      },
    ]
    for (const subscription of subscriptions) {
      await createSubscription(subscription.url, subscription.secret)
    }

    const target = await createTask('Target task')
    const duplicate = await createTask('Duplicate task')
    const completed = await createTask('Completed task')
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 202 }))

    const duplicateResponse = await app.request(
      `/api/tasks/${duplicate.id}/status`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'completed',
          statusReason: 'duplicate',
          duplicateOfTaskId: target.id,
        }),
      },
    )
    const completeResponse = await app.request(
      `/api/tasks/${completed.id}/complete`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      },
    )
    const replayResponse = await app.request(
      `/api/tasks/${duplicate.id}/status`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'completed',
          statusReason: 'duplicate',
          duplicateOfTaskId: target.id,
        }),
      },
    )
    const reasonChangeResponse = await app.request(
      `/api/tasks/${duplicate.id}/status`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'completed',
          statusReason: 'completed',
        }),
      },
    )

    const duplicateEvent = {
      event: 'task.status_changed',
      task: {
        id: duplicate.id,
        number: duplicate.number,
        status: 'completed',
        statusReason: 'duplicate',
        duplicateOfTask: {
          id: target.id,
          number: target.number,
          title: target.title,
        },
      },
    }
    const completeEvent = {
      event: 'task.status_changed',
      task: {
        id: completed.id,
        number: completed.number,
        status: 'completed',
        statusReason: 'completed',
      },
    }
    const reasonChangeEvent = {
      event: 'task.status_changed',
      task: {
        id: duplicate.id,
        number: duplicate.number,
        status: 'completed',
        statusReason: 'completed',
      },
    }
    const deliveries = fetchSpy.mock.calls
      .map(([input, init]) => {
        const headers = new Headers(init?.headers)
        const parsedBody = taskStatusChangedWebhookEventSchema.safeParse(
          typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
        )
        return {
          url:
            input instanceof URL
              ? input.toString()
              : input instanceof Request
                ? input.url
                : input,
          method: init?.method,
          contentType: headers.get('Content-Type'),
          signature: headers.get('X-Tq-Signature-256'),
          body: parsedBody.success ? parsedBody.data : null,
        }
      })
      .sort((a, b) => {
        const aTaskId = a.body?.task.id ?? ''
        const bTaskId = b.body?.task.id ?? ''
        return `${aTaskId}:${a.url}`.localeCompare(`${bTaskId}:${b.url}`)
      })
    const expectedDeliveries = [
      ...subscriptions.map((subscription) => ({
        url: subscription.url,
        method: 'POST',
        contentType: 'application/json',
        signature: signature(subscription.secret, duplicateEvent),
        body: duplicateEvent,
      })),
      ...subscriptions.map((subscription) => ({
        url: subscription.url,
        method: 'POST',
        contentType: 'application/json',
        signature: signature(subscription.secret, completeEvent),
        body: completeEvent,
      })),
      ...subscriptions.map((subscription) => ({
        url: subscription.url,
        method: 'POST',
        contentType: 'application/json',
        signature: signature(subscription.secret, reasonChangeEvent),
        body: reasonChangeEvent,
      })),
    ].sort((a, b) =>
      `${a.body.task.id}:${a.url}`.localeCompare(`${b.body.task.id}:${b.url}`),
    )

    const deliverySnapshot = () => ({
      duplicateStatus: duplicateResponse.status,
      completeStatus: completeResponse.status,
      replayStatus: replayResponse.status,
      reasonChangeStatus: reasonChangeResponse.status,
      deliveries,
    })

    expect(deliverySnapshot()).toEqual({
      duplicateStatus: 200,
      completeStatus: 200,
      replayStatus: 200,
      reasonChangeStatus: 200,
      deliveries: expectedDeliveries,
    })
  })

  it('keeps a committed task status when a delivery fails', async () => {
    await createSubscription(
      'https://hooks.example.invalid/unavailable',
      'test-webhook-secret',
    )
    const task = await createTask('Task with an unavailable webhook')
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('connection refused'))

    const response = await app.request(`/api/tasks/${task.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    })
    const [saved] = await db
      .select({ status: tasks.status, statusReason: tasks.statusReason })
      .from(tasks)
      .where(eq(tasks.id, task.id))

    const failureSnapshot = () => ({
      responseStatus: response.status,
      saved,
      deliveryCount: fetchSpy.mock.calls.length,
    })

    expect(failureSnapshot()).toEqual({
      responseStatus: 200,
      saved: { status: 'completed', statusReason: 'completed' },
      deliveryCount: 1,
    })
  })
})
