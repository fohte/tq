import { callInternalRoute } from '@api/routes/mcp/route-bridge'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

const testApp = new Hono()
  .post(
    '/widgets',
    zValidator('json', z.object({ title: z.string(), count: z.number() })),
    (c) => c.json({ title: c.req.valid('json').title }, 201),
  )
  .get('/widgets/:id', (c) => {
    if (c.req.param('id') !== 'known') {
      return c.json({ error: 'Widget not found' }, 404)
    }
    return c.json({ id: 'known' })
  })
  .get('/boom', () => {
    throw new Error('boom')
  })

describe('callInternalRoute', () => {
  it('returns the parsed body on success', async () => {
    const result = await callInternalRoute(testApp, '/widgets/known')

    expect(result).toEqual({ ok: true, data: { id: 'known' } })
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
            text: 'Invalid request: title: Invalid input: expected string, received undefined; count: Invalid input: expected number, received string',
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
