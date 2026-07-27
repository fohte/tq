import { app } from '@api/app'
import { setupTestDb } from '@api/testing'
import { describe, expect, it } from 'vitest'

<<<<<<< before updating
setupTestDb()
||||||| last update
import { greet } from '@/index'
=======
import { greet } from '#index'
>>>>>>> after updating

describe('GET /health', () => {
  it('ステータス ok を返す', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })
})
