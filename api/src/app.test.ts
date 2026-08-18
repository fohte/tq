import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { describe, expect, it } from 'vitest'

import { onError } from '#app'

// No route in this app currently throws an HTTPException (each validator
// returns its own response instead of throwing), so `onError` is exercised
// directly through a throwaway app rather than through `app.request(...)`.
describe('onError', () => {
  it('returns an HTTPException as its own status and body instead of a generic 500', async () => {
    const app = new Hono()
      .get('/throws', () => {
        throw new HTTPException(404, {
          res: new Response(JSON.stringify({ error: 'not found' }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        })
      })
      .onError(onError)

    const res = await app.request('/throws')

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'not found' })
  })

  it('reports an unexpected error and returns a generic 500', async () => {
    const app = new Hono()
      .get('/throws', () => {
        throw new Error('boom')
      })
      .onError(onError)

    const res = await app.request('/throws')

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Internal server error' })
  })
})
