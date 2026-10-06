import { Hono } from 'hono'
import { afterEach, describe, expect, it } from 'vitest'

import { authorMiddleware } from '#lib/author'
import {
  type ChangeEvent,
  changeEventMiddleware,
  publishChangeEvent,
  subscribeToChangeEvents,
} from '#lib/change-events'
import { eventsApp } from '#routes/events'

describe('change events', () => {
  let events: ChangeEvent[] = []
  let unsubscribe: (() => void) | undefined

  afterEach(() => {
    unsubscribe?.()
    unsubscribe = undefined
    events = []
  })

  function makeApp() {
    const routes = new Hono()
      .patch('/:id', (c) => c.json({ author: c.get('author') }))
      .patch('/failed/:id', (c) => c.json({ error: 'failed' }, 409))
      .get('/:id', (c) => c.json({ id: c.req.param('id') }))

    unsubscribe = subscribeToChangeEvents((event) => events.push(event))
    return new Hono()
      .use('*', authorMiddleware)
      .use('*', changeEventMiddleware)
      .route('/api/tasks', routes)
      .route(
        '/api/mcp',
        new Hono().post('/', (c) => c.json({ ok: true })),
      )
  }

  async function request(
    path: string,
    init: RequestInit,
  ): Promise<{ status: number; body: unknown; events: ChangeEvent[] }> {
    const response = await makeApp().request(path, init)
    return {
      status: response.status,
      body: await response.json(),
      events,
    }
  }

  it('uses the screen ID in human author headers as the event origin', async () => {
    expect(
      await request('/api/tasks/task-id', {
        method: 'PATCH',
        headers: { 'X-Author': 'human:screen-id' },
      }),
    ).toEqual({
      status: 200,
      body: { author: { kind: 'human', agent: null } },
      events: [{ resource: 'task', id: 'task-id', origin: 'screen-id' }],
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
      events: [{ resource: 'task', id: 'task-id', origin: null }],
    })
  })

  it('keeps the default human author when the author header is absent', async () => {
    expect(await request('/api/tasks/task-id', { method: 'PATCH' })).toEqual({
      status: 200,
      body: { author: { kind: 'human', agent: null } },
      events: [{ resource: 'task', id: 'task-id', origin: null }],
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
          new Hono().patch('/time-blocks/:id', (c) => c.json({ ok: true })),
        ),
      )
    unsubscribe = subscribeToChangeEvents((event) => events.push(event))

    const response = await app.request('/api/schedule/time-blocks/block-id', {
      method: 'PATCH',
    })

    const snapshot = () => ({ status: response.status, events })
    expect(snapshot()).toEqual({
      status: 200,
      events: [{ resource: 'time_block', id: 'block-id', origin: null }],
    })
  })

  it('does not emit for invalid headers, failed responses, GET, or MCP writes', async () => {
    const app = makeApp()
    const invalid = await app.request('/api/tasks/task-id', {
      method: 'PATCH',
      headers: { 'X-Author': 'robot' },
    })
    const failed = await app.request('/api/tasks/failed/task-id', {
      method: 'PATCH',
    })
    const read = await app.request('/api/tasks/task-id')
    const mcp = await app.request('/api/mcp', { method: 'POST' })

    const snapshot = async () => ({
      invalid: { status: invalid.status, body: await invalid.json() },
      failed: { status: failed.status, body: await failed.json() },
      read: { status: read.status, body: await read.json() },
      mcp: { status: mcp.status, body: await mcp.json() },
      events,
    })
    expect(await snapshot()).toEqual({
      invalid: {
        status: 400,
        body: { error: 'Invalid X-Author header' },
      },
      failed: { status: 409, body: { error: 'failed' } },
      read: { status: 200, body: { id: 'task-id' } },
      mcp: { status: 200, body: { ok: true } },
      events: [],
    })
  })

  it('streams named change events as JSON', async () => {
    const response = await new Hono()
      .route('/api', eventsApp)
      .request('/api/events')
    const reader = response.body?.getReader() as
      ReadableStreamDefaultReader<Uint8Array> | undefined
    publishChangeEvent({ resource: 'task', id: 'task-id', origin: null })
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
        'event: change\ndata: {"resource":"task","id":"task-id","origin":null}\n\n',
    })
  })
})
