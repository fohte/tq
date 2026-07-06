import { app } from '@api/app'
import { db } from '@api/db/connection'
import { images } from '@api/db/schema'
import { MAX_SIZE_BYTES } from '@api/services/images'
import * as r2 from '@api/services/r2'
import { jsonBody, makeFile, setupTestDb } from '@api/testing'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@api/services/r2')

setupTestDb()

const TEST_UUID = '550e8400-e29b-41d4-a716-446655440000'
const SIGNED_URL = 'https://signed.example.com/images/test'

interface ImageResponse {
  id: string
  r2Key: string
  contentType: string
  sizeBytes: number
  url: string
}

beforeEach(() => {
  vi.mocked(r2.putObject).mockReset().mockResolvedValue(undefined)
  vi.mocked(r2.getObjectSignedUrl).mockReset().mockResolvedValue(SIGNED_URL)
  vi.mocked(r2.deleteObjectByKey).mockReset().mockResolvedValue(undefined)
})

function uploadImageRequest(file: File) {
  const form = new FormData()
  form.set('file', file)
  return app.request('/api/images', { method: 'POST', body: form })
}

async function uploadImage(file: File) {
  const res = await uploadImageRequest(file)
  if (res.status !== 201) {
    throw new Error(
      `Failed to upload image: ${String(res.status)} ${await res.text()}`,
    )
  }
  return jsonBody<ImageResponse>(res)
}

describe('POST /api/images', () => {
  it('uploads an image and returns its metadata with a signed URL', async () => {
    const file = makeFile('photo.png', 'image/png', 1234)

    const res = await uploadImageRequest(file)

    expect(res.status).toBe(201)
    const body = await jsonBody<ImageResponse>(res)
    expect({
      ...body,
      id: 'ID',
      r2Key: body.r2Key.replace(body.id, 'ID'),
    }).toEqual({
      id: 'ID',
      r2Key: 'images/ID',
      contentType: 'image/png',
      sizeBytes: 1234,
      url: SIGNED_URL,
    })

    const [saved] = await db.select().from(images).where(eq(images.id, body.id))
    expect(saved?.r2Key).toBe(body.r2Key)
  })

  it('returns 400 for an unsupported content type', async () => {
    const res = await uploadImageRequest(
      makeFile('doc.pdf', 'application/pdf', 10),
    )

    expect(res.status).toBe(400)
  })

  it('returns 413 for a file exceeding the size limit', async () => {
    const res = await uploadImageRequest(
      makeFile('big.png', 'image/png', MAX_SIZE_BYTES + 1),
    )

    expect(res.status).toBe(413)
  })
})

describe('GET /api/images/:id', () => {
  it('returns a signed URL for an existing image', async () => {
    const image = await uploadImage(makeFile('photo.png', 'image/png', 10))

    const res = await app.request(`/api/images/${image.id}`)

    expect(res.status).toBe(200)
    expect(await jsonBody(res)).toEqual({ url: SIGNED_URL })
  })

  it('returns 404 for a non-existent image', async () => {
    const res = await app.request(`/api/images/${TEST_UUID}`)

    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/images/:id', () => {
  it('deletes an existing image', async () => {
    const image = await uploadImage(makeFile('photo.png', 'image/png', 10))

    const res = await app.request(`/api/images/${image.id}`, {
      method: 'DELETE',
    })

    expect(res.status).toBe(204)
    const rows = await db.select().from(images).where(eq(images.id, image.id))
    expect(rows).toEqual([])
  })

  it('returns 404 for a non-existent image', async () => {
    const res = await app.request(`/api/images/${TEST_UUID}`, {
      method: 'DELETE',
    })

    expect(res.status).toBe(404)
  })
})
