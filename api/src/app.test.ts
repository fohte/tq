import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { describe, expect, it } from 'vitest'

import { onError } from '#app'

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
})
