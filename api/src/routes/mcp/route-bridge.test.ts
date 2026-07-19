import { callInternalRoute } from '@api/routes/mcp/route-bridge'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

const testApp = new Hono()
  .post(
    '/widgets',
    zValidator(
      'json',
      z.object({
        title: z.string({ error: 'title must be a string' }),
        count: z.number({ error: 'count must be a number' }),
      }),
    ),
    (c) => c.json({ title: c.req.valid('json').title }, 201),
  )
  .get('/widgets/:id', (c) => {
    if (c.req.param('id') !== 'known') {
      return c.json({ error: 'Widget not found' }, 404)
    }
    return c.json({ id: 'known' })
  })
  .delete('/widgets/:id', (c) => c.body(null, 204))
  .post('/widgets/:id/lock', (c) =>
    c.json({ error: 'Widget is already locked' }, 409),
  )
  .get('/boom', () => {
    throw new Error('boom')
  })

describe('callInternalRoute', () => {
  it('returns the parsed body on success', async () => {
    const result = await callInternalRoute(testApp, '/widgets/known')

    expect(result).toEqual({ ok: true, data: { id: 'known' } })
  })

  it('returns undefined data for a 204 response with no body', async () => {
    const result = await callInternalRoute(testApp, '/widgets/known', {
      method: 'DELETE',
    })

    expect(result).toEqual({ ok: true, data: undefined })
  })

  it('maps a 400 validation error to a field-level message', async () => {
    const result = await callInternalRoute(testApp, '/widgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: 'not-a-number' }),
    })

    expect(result).toEqual({
      ok: false,
      result: {
        isError: true,
        content: [
          {
            type: 'text',
            text: 'Invalid request: title: title must be a string; count: count must be a number',
          },
        ],
      },
    })
  })

  it('maps a 404 to the resource-not-found message from the response body', async () => {
    const result = await callInternalRoute(testApp, '/widgets/unknown')

    expect(result).toEqual({
      ok: false,
      result: {
        isError: true,
        content: [{ type: 'text', text: 'Widget not found' }],
      },
    })
  })

  it('maps a 409 to the conflict message from the response body', async () => {
    const result = await callInternalRoute(testApp, '/widgets/known/lock', {
      method: 'POST',
    })

    expect(result).toEqual({
      ok: false,
      result: {
        isError: true,
        content: [{ type: 'text', text: 'Widget is already locked' }],
      },
    })
  })

  it('maps a 5xx to a generic message without internal details', async () => {
    const result = await callInternalRoute(testApp, '/boom')

    expect(result).toEqual({
      ok: false,
      result: {
        isError: true,
        content: [
          {
            type: 'text',
            text: 'An internal error occurred while processing the request.',
          },
        ],
      },
    })
  })
})
