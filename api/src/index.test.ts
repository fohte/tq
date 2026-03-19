import { describe, expect, it } from 'vitest'

import { app } from '@api/app'

describe('GET /health', () => {
  it('ステータス ok を返す', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })
})
