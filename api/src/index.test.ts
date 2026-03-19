import { app } from '@api/app'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@api/db/connection', () => ({
  db: {},
}))

describe('GET /health', () => {
  it('ステータス ok を返す', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })
})
