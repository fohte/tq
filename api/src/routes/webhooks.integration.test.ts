import { createHmac } from 'node:crypto'

import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { app } from '#app'
import { db } from '#db/connection'
import { tasks, webhookSubscriptions } from '#db/schema'
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

function signature(secret: string, body: string) {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`
}

function captureDeliveries(
  calls: ReadonlyArray<Parameters<typeof fetch>>,
  subscriptions: { url: string; secret: string }[],
) {
  return calls
    .map(([input, init]) => {
      const headers = new Headers(init?.headers)
      const url =
        input instanceof URL
          ? input.toString()
          : input instanceof Request
            ? input.url
            : input
      const body = typeof init?.body === 'string' ? init.body : ''
      const parsedBody: unknown = body === '' ? null : JSON.parse(body)
      const validatedBody =
        parsedBody == null
          ? null
          : taskStatusChangedWebhookEventSchema.parse(parsedBody)
      const subscription = subscriptions.find(
        (candidate) => candidate.url === url,
      )
      const signatureHeader = headers.get('X-Tq-Signature-256')

      return {
        url,
        method: init?.method,
        contentType: headers.get('Content-Type'),
        signatureValid:
          subscription != null &&
          signatureHeader === signature(subscription.secret, body),
        body: normalizeEvent(parsedBody),
        taskId: validatedBody?.task.id ?? '',
      }
    })
    .sort((a, b) => a.url.localeCompare(b.url))
    .map((delivery) => ({
      url: delivery.url,
      method: delivery.method,
      contentType: delivery.contentType,
      signatureValid: delivery.signatureValid,
      body: delivery.body,
    }))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null && !Array.isArray(value)
}

function normalizeEvent(value: unknown): unknown {
  if (!isRecord(value) || !isRecord(value['task'])) {
    return value
  }

  const task = value['task']
  const duplicateOfTask = task['duplicateOfTask']
  return {
    ...value,
    occurredAt: 'OCCURRED_AT',
    task: {
      ...task,
      id: 'TASK_ID',
      number: 123,
      ...(typeof duplicateOfTask === 'object' &&
      duplicateOfTask != null &&
      !Array.isArray(duplicateOfTask)
        ? {
            duplicateOfTask: {
              ...duplicateOfTask,
              id: 'DUPLICATE_TASK_ID',
              number: 456,
            },
          }
        : {}),
    },
  }
}

function expectedDelivery(url: string, body: unknown) {
  return {
    url,
    method: 'POST',
    contentType: 'application/json',
    signatureValid: true,
    body,
  }
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

  it('reuses a subscription URL and updates its signing secret', async () => {
    const url = 'https://hooks.example.invalid/tq'
    const firstResponse = await createSubscription(url, 'old-secret')
    const first = await jsonBody<{ id: string }>(firstResponse)
    const secondResponse = await createSubscription(url, 'new-secret')
    const second = await jsonBody<{ id: string }>(secondResponse)
    const [saved] = await db
      .select({
        id: webhookSubscriptions.id,
        url: webhookSubscriptions.url,
        secret: webhookSubscriptions.secret,
      })
      .from(webhookSubscriptions)
      .where(eq(webhookSubscriptions.url, url))
    const listResponse = await app.request('/api/webhooks')
    const listed =
      await jsonBody<
        { id: string; url: string; createdAt: string; secret?: string }[]
      >(listResponse)

    const subscriptionSnapshot = () => ({
      statuses: [firstResponse.status, secondResponse.status],
      idsMatch: first.id === second.id,
      saved: saved == null ? null : { ...saved, id: 'ID' },
      listed: listed.map(normalizeSubscription),
      listedIncludesSecret: listed.some((subscription) =>
        Object.hasOwn(subscription, 'secret'),
      ),
    })

    expect(subscriptionSnapshot()).toEqual({
      statuses: [201, 201],
      idsMatch: true,
      saved: { id: 'ID', url, secret: 'new-secret' },
      listed: [{ id: 'ID', url, createdAt: 'CREATED_AT' }],
      listedIncludesSecret: false,
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
  it('sends signed duplicate events to every subscription', async () => {
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
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 202 }))

    const response = await app.request(`/api/tasks/${duplicate.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'completed',
        statusReason: 'duplicate',
        duplicateOfTaskId: target.id,
      }),
    })
    const duplicateEvent = {
      event: 'task.status_changed',
      occurredAt: 'OCCURRED_AT',
      task: {
        id: 'TASK_ID',
        number: 123,
        status: 'completed',
        statusReason: 'duplicate',
        duplicateOfTask: {
          id: 'DUPLICATE_TASK_ID',
          number: 456,
          title: target.title,
        },
      },
    }
    const webhookSnapshot = () => ({
      responseStatus: response.status,
      deliveries: captureDeliveries(fetchSpy.mock.calls, subscriptions),
    })

    expect(webhookSnapshot()).toEqual({
      responseStatus: 200,
      deliveries: subscriptions.map((subscription) =>
        expectedDelivery(subscription.url, duplicateEvent),
      ),
    })
  })

  it('sends a webhook when a task is completed through the complete route', async () => {
    const subscription = {
      url: 'https://hooks.example.invalid/complete',
      secret: 'test-complete-secret',
    }
    await createSubscription(subscription.url, subscription.secret)
    const task = await createTask('Task completed through the complete route')
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 202 }))
    const response = await app.request(`/api/tasks/${task.id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const event = {
      event: 'task.status_changed',
      occurredAt: 'OCCURRED_AT',
      task: {
        id: 'TASK_ID',
        number: 123,
        status: 'completed',
        statusReason: 'completed',
      },
    }
    const webhookSnapshot = () => ({
      responseStatus: response.status,
      deliveries: captureDeliveries(fetchSpy.mock.calls, [subscription]),
    })

    expect(webhookSnapshot()).toEqual({
      responseStatus: 200,
      deliveries: [expectedDelivery(subscription.url, event)],
    })
  })

  it('does not send a webhook for an unchanged status and reason', async () => {
    const subscription = {
      url: 'https://hooks.example.invalid/unchanged',
      secret: 'test-unchanged-secret',
    }
    await createSubscription(subscription.url, subscription.secret)
    const task = await createTask('Task with an unchanged status')
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 202 }))
    await app.request(`/api/tasks/${task.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    })
    fetchSpy.mockClear()
    const response = await app.request(`/api/tasks/${task.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    })

    const webhookSnapshot = () => ({
      responseStatus: response.status,
      deliveries: captureDeliveries(fetchSpy.mock.calls, [subscription]),
    })

    expect(webhookSnapshot()).toEqual({
      responseStatus: 200,
      deliveries: [],
    })
  })

  it('sends a webhook when statusReason changes without changing status', async () => {
    const subscription = {
      url: 'https://hooks.example.invalid/reason-change',
      secret: 'test-reason-change-secret',
    }
    await createSubscription(subscription.url, subscription.secret)
    const task = await createTask('Task with a changed status reason')
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 202 }))
    await app.request(`/api/tasks/${task.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed', statusReason: 'completed' }),
    })
    fetchSpy.mockClear()
    const response = await app.request(`/api/tasks/${task.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'completed',
        statusReason: 'not_planned',
      }),
    })
    const event = {
      event: 'task.status_changed',
      occurredAt: 'OCCURRED_AT',
      task: {
        id: 'TASK_ID',
        number: 123,
        status: 'completed',
        statusReason: 'not_planned',
      },
    }
    const webhookSnapshot = () => ({
      responseStatus: response.status,
      deliveries: captureDeliveries(fetchSpy.mock.calls, [subscription]),
    })

    expect(webhookSnapshot()).toEqual({
      responseStatus: 200,
      deliveries: [expectedDelivery(subscription.url, event)],
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
