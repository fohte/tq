import { Hono } from 'hono'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { authorMiddleware } from '#lib/author'
import {
  type ChangeEvent,
  changeEventMiddleware,
  publishChangeEvent,
  subscribeToChangeEvents,
} from '#lib/change-events'
import { eventsApp } from '#routes/events'

describe('change events', () => {
  const taskId = '00000000-0000-4000-8000-000000000001'
  let events: ChangeEvent[] = []
  let unsubscribe: (() => void) | undefined

  afterEach(() => {
    unsubscribe?.()
    unsubscribe = undefined
    events = []
    vi.useRealTimers()
  })

  function makeApp() {
    const routes = new Hono<{ Variables: { task: { id: string } } }>()
      .use('*', async (c, next) => {
        c.set('task', { id: taskId })
        return next()
      })
      .patch('/:id', (c) => {
        c.set('changeEventTaskIds', [taskId])
        return c.json({ author: c.get('author') })
      })
      .patch('/default-task-ids/:id', (c) => c.json({ ok: true }))
      .patch('/failed/:id', (c) => c.json({ error: 'failed' }, 409))
      .get('/:id', (c) => c.json({ id: c.req.param('id') }))

    unsubscribe = subscribeToChangeEvents((event) => events.push(event))
    return new Hono()
      .use('*', authorMiddleware)
      .use('*', changeEventMiddleware)
      .route('/api/tasks', routes)
      .route(
        '/api/labels',
        new Hono().patch('/:id', (c) => c.json({ ok: true })),
      )
      .route(
        '/api/mcp',
        new Hono().post('/', (c) => c.json({ ok: true })),
      )
      .route(
        '/api/github',
        new Hono()
          .post('/resolve', (c) => c.json({ preview: true }))
          .post('/sync', (c) => c.body(null, 204)),
      )
      .route(
        '/api/tasks/:taskId/github-link',
        new Hono().post('/sync', (c) => c.body(null, 204)),
      )
  }

  async function request(
    path: string,
    init: RequestInit,
  ): Promise<{ status: number; body: unknown; events: ChangeEvent[] }> {
    const response = await makeApp().request(path, init)
    return {
      status: response.status,
      body: response.status === 204 ? null : await response.json(),
      events,
    }
  }

  it('uses the resolved task ID for numeric task routes', async () => {
    expect(
      await request('/api/tasks/901234', {
        method: 'PATCH',
        headers: { 'X-Author': 'human:screen-id' },
      }),
    ).toEqual({
      status: 200,
      body: { author: { kind: 'human', agent: null } },
      events: [
        {
          resource: 'task',
          id: taskId,
          origin: 'screen-id',
          taskIds: [taskId],
        },
      ],
    })
  })

  it('keeps LLM author metadata and does not treat it as a screen origin', async () => {
    expect(
      await request('/api/tasks/task-id', {
        method: 'PATCH',
        headers: { 'X-Author': 'llm:agent' },
      }),
    ).toEqual({
      status: 200,
      body: { author: { kind: 'llm', agent: 'agent' } },
      events: [
        { resource: 'task', id: taskId, origin: null, taskIds: [taskId] },
      ],
    })
  })

  it('defaults task resource events to the resolved task ID', async () => {
    expect(
      await request('/api/tasks/default-task-ids/task-id', { method: 'PATCH' }),
    ).toEqual({
      status: 200,
      body: { ok: true },
      events: [
        { resource: 'task', id: taskId, origin: null, taskIds: [taskId] },
      ],
    })
  })

  it('leaves task IDs unknown when a non-task route does not set them', async () => {
    expect(await request('/api/labels/label-id', { method: 'PATCH' })).toEqual({
      status: 200,
      body: { ok: true },
      events: [
        {
          resource: 'label',
          id: 'label-id',
          origin: null,
          taskIds: null,
        },
      ],
    })
  })

  it('keeps the default human author when the author header is absent', async () => {
    expect(await request('/api/tasks/task-id', { method: 'PATCH' })).toEqual({
      status: 200,
      body: { author: { kind: 'human', agent: null } },
      events: [
        { resource: 'task', id: taskId, origin: null, taskIds: [taskId] },
      ],
    })
  })

  it('maps time block routes to the time_block resource', async () => {
    const app = new Hono()
      .use('*', authorMiddleware)
      .use('*', changeEventMiddleware)
      .route(
        '/api',
        new Hono().route(
          '/schedule',
          new Hono().patch('/time-blocks/:id', (c) => {
            c.set('changeEventTaskIds', [])
            return c.json({ ok: true })
          }),
        ),
      )
    unsubscribe = subscribeToChangeEvents((event) => events.push(event))

    const response = await app.request('/api/schedule/time-blocks/block-id', {
      method: 'PATCH',
    })

    const snapshot = () => ({ status: response.status, events })
    expect(snapshot()).toEqual({
      status: 200,
      events: [
        {
          resource: 'time_block',
          id: 'block-id',
          origin: null,
          taskIds: [],
        },
      ],
    })
  })

  it('does not emit for invalid author headers', async () => {
    expect(
      await request('/api/tasks/task-id', {
        method: 'PATCH',
        headers: { 'X-Author': 'robot' },
      }),
    ).toEqual({
      status: 400,
      body: { error: 'Invalid X-Author header' },
      events: [],
    })
  })

  it('does not emit for failed writes', async () => {
    expect(
      await request('/api/tasks/failed/task-id', { method: 'PATCH' }),
    ).toEqual({
      status: 409,
      body: { error: 'failed' },
      events: [],
    })
  })

  it('does not emit for GET requests', async () => {
    expect(await request('/api/tasks/task-id', { method: 'GET' })).toEqual({
      status: 200,
      body: { id: 'task-id' },
      events: [],
    })
  })

  it('does not emit for MCP writes', async () => {
    expect(await request('/api/mcp', { method: 'POST' })).toEqual({
      status: 200,
      body: { ok: true },
      events: [],
    })
  })

  it('does not emit generic events for GitHub URL previews', async () => {
    expect(await request('/api/github/resolve', { method: 'POST' })).toEqual({
      status: 200,
      body: { preview: true },
      events: [],
    })
  })

  it('does not emit generic events for manual GitHub sync', async () => {
    expect(await request('/api/github/sync', { method: 'POST' })).toEqual({
      status: 204,
      body: null,
      events: [],
    })
  })

  it('does not emit generic events for task GitHub link sync', async () => {
    expect(
      await request('/api/tasks/task-id/github-link/sync', { method: 'POST' }),
    ).toEqual({
      status: 204,
      body: null,
      events: [],
    })
  })

  it('streams named change events as JSON', async () => {
    const response = await new Hono()
      .route('/api', eventsApp)
      .request('/api/events')
    const reader = response.body?.getReader() as
      ReadableStreamDefaultReader<Uint8Array> | undefined
    publishChangeEvent({
      resource: 'task',
      id: 'task-id',
      origin: null,
      taskIds: ['task-id'],
    })
    const firstChunk = await reader?.read()
    await reader?.cancel()

    const snapshot = () => ({
      status: response.status,
      contentType: response.headers.get('Content-Type'),
      chunk:
        firstChunk?.value == null
          ? null
          : new TextDecoder().decode(firstChunk.value),
    })
    expect(snapshot()).toEqual({
      status: 200,
      contentType: 'text/event-stream',
      chunk:
        'event: change\ndata: {"resource":"task","id":"task-id","origin":null,"taskIds":["task-id"]}\n\n',
    })
  })

  it('sends a heartbeat after 30 seconds without changes', async () => {
    vi.useFakeTimers()
    const response = await new Hono()
      .route('/api', eventsApp)
      .request('/api/events')
    const reader = response.body?.getReader() as
      ReadableStreamDefaultReader<Uint8Array> | undefined
    const nextChunk = reader?.read()

    await vi.advanceTimersByTimeAsync(30_000)
    const chunk = await nextChunk
    await reader?.cancel()

    const snapshot = () =>
      chunk?.value == null ? null : new TextDecoder().decode(chunk.value)
    expect(snapshot()).toEqual(': heartbeat\n\n')
  })
})
