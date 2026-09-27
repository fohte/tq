import { eq } from 'drizzle-orm'
import { okAsync } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { app } from '#app'
import { db } from '#db/connection'
import { assets } from '#db/schema'
import { MAX_SIZE_BYTES } from '#services/assets'
import * as r2 from '#services/r2'
import { jsonBody, makeFile, setupTestDb } from '#testing'

vi.mock('#services/r2')

setupTestDb()

const TEST_UUID = '550e8400-e29b-41d4-a716-446655440000'
const SIGNED_URL = 'https://signed.example.com/assets/test'

interface AssetResponse {
  id: string
  r2Key: string
  contentType: string
  sizeBytes: number
  url: string
}

beforeEach(() => {
  vi.mocked(r2.putObject).mockReset().mockReturnValue(okAsync(undefined))
  vi.mocked(r2.getObjectSignedUrl)
    .mockReset()
    .mockReturnValue(okAsync(SIGNED_URL))
  vi.mocked(r2.deleteObjectByKey)
    .mockReset()
    .mockReturnValue(okAsync(undefined))
})

function uploadAssetRequest(file: File) {
  const form = new FormData()
  form.set('file', file)
  return app.request('/api/assets', { method: 'POST', body: form })
}

async function uploadAsset(file: File) {
  const res = await uploadAssetRequest(file)
  if (res.status !== 201) {
    throw new Error(
      `Failed to upload asset: ${String(res.status)} ${await res.text()}`,
    )
  }
  return jsonBody<AssetResponse>(res)
}

describe('POST /api/assets', () => {
  it('uploads an asset and returns its metadata with a signed URL', async () => {
    const file = makeFile('photo.png', 'image/png', 1234)

    const res = await uploadAssetRequest(file)

    expect(res.status).toBe(201)
    const body = await jsonBody<AssetResponse>(res)
    expect(body.id).toBeDefined()
    expect(body.r2Key).toBe(`assets/${body.id}`)
    expect(body.contentType).toBe('image/png')
    expect(body.sizeBytes).toBe(1234)
    expect(body.url).toBe(SIGNED_URL)

    const [saved] = await db.select().from(assets).where(eq(assets.id, body.id))
    expect(saved?.r2Key).toBe(body.r2Key)
  })

  it('returns 400 for an unsupported content type', async () => {
    const res = await uploadAssetRequest(
      makeFile('doc.pdf', 'application/pdf', 10),
    )

    expect(res.status).toBe(400)
  })

  it('returns 413 for a file exceeding the size limit', async () => {
    const res = await uploadAssetRequest(
      makeFile('big.png', 'image/png', MAX_SIZE_BYTES + 1),
    )

    expect(res.status).toBe(413)
  })
})

describe('GET /api/assets/:id', () => {
  it('returns a signed URL for an existing asset', async () => {
    const asset = await uploadAsset(makeFile('photo.png', 'image/png', 10))

    const res = await app.request(`/api/assets/${asset.id}`)

    expect(res.status).toBe(200)
    expect(await jsonBody(res)).toEqual({ url: SIGNED_URL })
  })

  it('returns 404 for a non-existent asset', async () => {
    const res = await app.request(`/api/assets/${TEST_UUID}`)

    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/assets/:id', () => {
  it('deletes an existing asset', async () => {
    const asset = await uploadAsset(makeFile('photo.png', 'image/png', 10))

    const res = await app.request(`/api/assets/${asset.id}`, {
      method: 'DELETE',
    })

    expect(res.status).toBe(204)
    const rows = await db.select().from(assets).where(eq(assets.id, asset.id))
    expect(rows).toEqual([])
  })

  it('returns 404 for a non-existent asset', async () => {
    const res = await app.request(`/api/assets/${TEST_UUID}`, {
      method: 'DELETE',
    })

    expect(res.status).toBe(404)
  })
})
