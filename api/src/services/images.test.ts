import { db } from '@api/db/connection'
import { images } from '@api/db/schema'
import {
  deleteImage,
  getImageSignedUrl,
  ImageNotFoundError,
  ImageTooLargeError,
  InvalidImageTypeError,
  MAX_SIZE_BYTES,
  uploadImage,
} from '@api/services/images'
import * as r2 from '@api/services/r2'
import { makeFile, setupTestDb } from '@api/testing'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@api/services/r2')

setupTestDb()

const TEST_UUID = '550e8400-e29b-41d4-a716-446655440000'
const SIGNED_URL = 'https://signed.example.com/images/test'

beforeEach(() => {
  vi.mocked(r2.putObject).mockReset().mockResolvedValue(undefined)
  vi.mocked(r2.getObjectSignedUrl).mockReset().mockResolvedValue(SIGNED_URL)
  vi.mocked(r2.deleteObjectByKey).mockReset().mockResolvedValue(undefined)
})

function normalize(image: typeof images.$inferSelect) {
  return {
    ...image,
    id: 'ID',
    r2Key: image.r2Key.replace(image.id, 'ID'),
    createdAt: 'DATE',
  }
}

describe('uploadImage', () => {
  it('stores metadata and uploads the file body to R2', async () => {
    const file = makeFile('photo.png', 'image/png', 1234)

    const image = await uploadImage(file)

    expect(normalize(image)).toEqual({
      id: 'ID',
      r2Key: 'images/ID',
      contentType: 'image/png',
      sizeBytes: 1234,
      createdAt: 'DATE',
    })
    expect(vi.mocked(r2.putObject).mock.calls).toEqual([
      [image.r2Key, Buffer.alloc(1234), 'image/png'],
    ])
  })

  it('rejects unsupported content types', async () => {
    const file = makeFile('doc.pdf', 'application/pdf', 100)

    await expect(uploadImage(file)).rejects.toThrow(InvalidImageTypeError)
    expect(r2.putObject).not.toHaveBeenCalled()
  })

  it('rejects files larger than the size limit', async () => {
    const file = makeFile('big.png', 'image/png', MAX_SIZE_BYTES + 1)

    await expect(uploadImage(file)).rejects.toThrow(ImageTooLargeError)
    expect(r2.putObject).not.toHaveBeenCalled()
  })
})

describe('getImageSignedUrl', () => {
  it('returns a signed URL for an existing image', async () => {
    const image = await uploadImage(makeFile('photo.png', 'image/png', 10))

    const url = await getImageSignedUrl(image.id)

    expect(url).toBe(SIGNED_URL)
    expect(vi.mocked(r2.getObjectSignedUrl).mock.calls).toEqual([
      [image.r2Key, 3600],
    ])
  })

  it('throws ImageNotFoundError for a non-existent image', async () => {
    await expect(getImageSignedUrl(TEST_UUID)).rejects.toThrow(
      ImageNotFoundError,
    )
  })
})

describe('deleteImage', () => {
  it('deletes the R2 object and the DB row', async () => {
    const image = await uploadImage(makeFile('photo.png', 'image/png', 10))

    await deleteImage(image.id)

    expect(vi.mocked(r2.deleteObjectByKey).mock.calls).toEqual([[image.r2Key]])
    const rows = await db.select().from(images).where(eq(images.id, image.id))
    expect(rows).toEqual([])
  })

  it('throws ImageNotFoundError for a non-existent image', async () => {
    await expect(deleteImage(TEST_UUID)).rejects.toThrow(ImageNotFoundError)
  })
})
